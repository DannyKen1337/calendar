"use client";
import { useState } from 'react';
import Link from 'next/link';
import { getGameConfig, getGameColor } from '@/lib/gameConfig';
import { groupByGame, maxSelectable, formatPrice } from '@/lib/preorders';
import { Field, Progress, ErrorSummary, SubmitButton, Success, ICONS } from '@/components/FormKit';
import s from './PreorderPage.module.css';

// Nyilvános előrendelő (feliratkozási) oldal. focusId: a megosztott linkben megadott termék (?termek=...),
// ilyenkor csak az a termék látszik, előre kiválasztva. A felépítés a régi (1. mit kérsz, 2. elérhetőségek); az űrlap
// elemei a FormKitből jönnek. A termékek egész kártyára kattintva választhatók, telefonon az összeg és a gomb alul ragad.
const DEFAULT_LOGO = '/jatekok/egyeb.png';
const FIELDS = ['name', 'email', 'phone'];
const LABELS = { items: 'Termék', name: 'Teljes név', email: 'E-mail cím', phone: 'Telefonszám' };

function check(field, value) {
  const v = value.trim();
  if (field === 'name') return v ? '' : 'Add meg a teljes neved.';
  if (field === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Érvényes e-mail címet adj meg (pl. nev@pelda.hu).';
  const digits = v.replace(/\D/g, '').length;
  return /^\+?[\d ()/-]{6,25}$/.test(v) && digits >= 6 && digits <= 15 ? '' : 'Érvényes telefonszámot adj meg (pl. +36 30 123 4567).';
}

// Darabszám: gombokkal vagy beírással, 1 és a termékre érvényes felső határ között
function QuantityStepper({ value, onChange, label, max }) {
  return (
    <div className={s.stepper} role="group" aria-label={`${label}: darabszám`} onClick={(e) => e.preventDefault()}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="Kevesebb">−</button>
      <input type="number" inputMode="numeric" min={1} max={max} value={value} aria-label={`${label}: darabszám`}
        onChange={(e) => { const n = parseInt(e.target.value, 10); if (Number.isFinite(n)) onChange(n); }} />
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Több">+</button>
    </div>
  );
}

const Shell = ({ children }) => <main className={s.page}><div className={s.wrap}>{children}</div></main>;
const Header = ({ subtitle, game, showAll }) => (
  <header className={s.head}>
    <p className={s.kicker}>Tavern{game ? ` · ${game}` : ''}</p>
    <h1 className={s.title}>Előrendelés</h1>
    {subtitle && <p className={s.sub}>{subtitle}</p>}
    {showAll && <a className={s.allLink} href="/elorendeles">Összes előrendelés ›</a>}
  </header>
);

// game: játék-link (?jatek=) esetén a játék neve; ilyenkor és termék-linknél „Összes előrendelés” link az összesítőre
export default function PreorderPage({ products = [], focusId = null, game = null, maintenance = false, loadError = false }) {
  const focused = focusId ? products.find(p => p.id === focusId) : null;
  const shown = focused ? [focused] : products;
  const [selected, setSelected] = useState(() => (focused && maxSelectable(focused, focused.remaining) > 0 ? { [focused.id]: 1 } : {}));
  const [values, setValues] = useState({ name: '', email: '', phone: '', website: '' });
  const [touched, setTouched] = useState({});
  const [serverErrors, setServerErrors] = useState({});
  const [tries, setTries] = useState(0);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  if (maintenance) return <Shell><Header /><div className={`${s.panel} ${s.center}`}><p className={s.p}>Az előrendelés átmenetileg nem elérhető. Kérjük, nézz vissza később!</p></div></Shell>;
  if (loadError) return <Shell><Header /><div className={`${s.panel} ${s.center}`}><p className={s.p}>Az oldal most nem tölthető be. Kérjük, próbáld újra pár perc múlva.</p></div></Shell>;

  const notFoundNotice = focusId && !focused && (
    <div className={s.notice}>Ennek a terméknek az előrendelése már lezárult, vagy a link hibás.{products.length > 0 ? ' Alább a jelenleg nyitott előrendeléseket látod.' : ''}</div>
  );

  if (products.length === 0) {
    return <Shell><Header />{notFoundNotice}<div className={`${s.panel} ${s.center}`}><p className={s.p}>Jelenleg nincs nyitott előrendelés.</p></div></Shell>;
  }

  const chosen = shown.filter(p => selected[p.id]);
  // Végösszeg a kiválasztott, árral rendelkező termékekből (null, ha egyiknek sincs ára)
  const priced = chosen.filter(p => p.price !== null && p.price !== undefined);
  const totalPrice = priced.length ? priced.reduce((sum, p) => sum + p.price * selected[p.id], 0) : null;
  const hasUnpriced = priced.length > 0 && priced.length < chosen.length;
  const toggle = (id) => {
    setSelected(sel => { const next = { ...sel }; if (next[id]) delete next[id]; else next[id] = 1; return next; });
    if (serverErrors.items) setServerErrors(err => ({ ...err, items: '' }));
  };
  const maxOf = (id) => { const p = shown.find(x => x.id === id); return p ? maxSelectable(p, p.remaining) : 1; };
  const setQty = (id, qty) => setSelected(sel => ({ ...sel, [id]: Math.min(maxOf(id), Math.max(1, qty)) }));
  const set = (f) => (e) => {
    setValues(v => ({ ...v, [f]: e.target.value }));
    if (serverErrors[f]) setServerErrors(err => ({ ...err, [f]: '' }));
  };
  const leave = (f) => () => { if (values[f]) setTouched(t => ({ ...t, [f]: true })); };
  const itemsError = serverErrors.items || (tries > 0 && chosen.length === 0 ? 'Válassz legalább egy terméket.' : '');
  const errorOf = (f) => serverErrors[f] || ((touched[f] || tries > 0) ? check(f, values[f]) : '');
  const okOf = (f) => !!values[f].trim() && !check(f, values[f]) && !serverErrors[f];
  const done = (chosen.length > 0 ? 1 : 0) + FIELDS.filter(okOf).length;

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setTries(n => n + 1);
    if (chosen.length === 0 || FIELDS.some(f => check(f, values[f]))) return;
    setSubmitting(true);
    setFormError('');
    try {
      const res = await fetch('/api/preorders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name.trim(),
          email: values.email.trim().toLowerCase(),
          phone: values.phone.trim(),
          website: values.website,
          items: chosen.map(p => ({ productId: p.id, quantity: selected[p.id] })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.error) {
        const msg = (data && data.error) || 'Az előrendelés most nem sikerült. Próbáld újra később.';
        if (data?.field) setServerErrors(err => ({ ...err, [data.field]: msg }));
        else setFormError(msg);
        return;
      }
      setResult({ items: chosen.map(p => ({ name: p.name, quantity: selected[p.id], price: p.price })), total: totalPrice, updated: data.updated, mailSent: data.mailSent });
    } catch {
      setFormError('Hálózati hiba történt. Ellenőrizd az internetkapcsolatot, és próbáld újra.');
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <Shell>
        <Header />
        <div className={s.panel}>
          <Success title="Köszönjük, megkaptuk az előrendelésed!">
            <ul className={s.summaryList}>
              {result.items.map(i => <li key={i.name}><b>{i.name}</b> – {i.quantity} db{i.price !== null && i.price !== undefined ? ` × ${formatPrice(i.price)}` : ''}</li>)}
            </ul>
            {result.total !== null && <p className={s.p}>Végösszeg: <b>{formatPrice(result.total)}</b></p>}
            {result.updated > 0 && <p className={s.muted}>Erre a termékre ezzel az e-mail címmel már volt előrendelésed, azt frissítettük.</p>}
            <p className={s.muted}>Amikor a termék megérkezik, a megadott elérhetőségeiden keresünk.{result.mailSent ? ' A visszaigazolást elküldtük e-mailben.' : ''}</p>
          </Success>
        </div>
        <nav className={s.back}><Link href="/">Eseménynaptár</Link></nav>
      </Shell>
    );
  }

  const summary = tries > 0 ? [
    ...(itemsError ? [{ id: `termek-${shown[0].id}`, label: LABELS.items, message: itemsError }] : []),
    ...FIELDS.filter(f => errorOf(f)).map(f => ({ id: `elo-${f}`, label: LABELS[f], message: errorOf(f) })),
  ] : [];

  return (
    <Shell>
      <Header game={game} showAll={!!(focused || game)} subtitle={focused ? 'Add meg az adataidat, és jelezd, hány darabot kérsz.' : game ? `A(z) ${game} előrendelései. Válaszd ki, mire szeretnél feliratkozni.` : 'Válaszd ki, mire szeretnél feliratkozni, és add meg az elérhetőségeidet.'} />
      {notFoundNotice}
      <form onSubmit={submit} noValidate className={s.form}>
        <Progress done={done} total={1 + FIELDS.length} />
        <ErrorSummary items={summary} version={tries} />

        <section className={s.panel} aria-labelledby="elo-1">
          <h2 id="elo-1" className={s.h2}><span className={s.step}>1</span>Mit szeretnél előrendelni?</h2>
          <div className={s.groups}>
            {groupByGame(shown).map(({ game, items }) => (
              <section key={game} aria-label={game}>
                <div className={s.game}>
                  <img src={getGameConfig(game).logo || DEFAULT_LOGO} alt="" onError={(e) => { e.currentTarget.src = DEFAULT_LOGO; }} />
                  <h3 style={{ color: getGameColor({ category: game }) === '#6b7280' ? '#E0D6C8' : getGameColor({ category: game }) }}>{game}</h3>
                </div>
                <div className={s.items}>
                  {items.map(p => {
                    const isOn = !!selected[p.id];
                    const max = maxSelectable(p, p.remaining);
                    const soldOut = max === 0;
                    return (
                      <label key={p.id} className={`${s.item} ${isOn ? s.itemOn : ''} ${soldOut ? s.itemOut : ''}`} data-termek={p.id}>
                        <input id={`termek-${p.id}`} type="checkbox" className={s.checkInput} checked={isOn} disabled={soldOut} onChange={() => toggle(p.id)} />
                        <span className={s.check} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7" /></svg></span>
                        <span className={s.itemText}>
                          <b className={s.itemName}>{p.name}</b>
                          {p.price !== null && p.price !== undefined && <span className={s.price}>{formatPrice(p.price)}{isOn && selected[p.id] > 1 ? <span className={s.muted}> · {selected[p.id]} db: {formatPrice(p.price * selected[p.id])}</span> : null}</span>}
                          {soldOut && <span className={s.soldOut}>Elfogyott</span>}
                          {p.releaseDate && <span className={s.release}>Megjelenés: {p.releaseDate}</span>}
                          {!soldOut && (p.perPersonLimit > 0 || p.remaining !== null) && (
                            <span className={s.meta}>{[p.perPersonLimit > 0 && `Személyenként legfeljebb ${p.perPersonLimit} db`, p.remaining !== null && `Még ${p.remaining} db foglalható`].filter(Boolean).join(' · ')}</span>
                          )}
                          {p.description && <span className={s.desc}>{p.description}</span>}
                        </span>
                        {isOn && <QuantityStepper value={selected[p.id]} onChange={(q) => setQty(p.id, q)} label={p.name} max={max} />}
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          {itemsError && <p className={s.itemsError}>{itemsError}</p>}
        </section>

        <section className={`${s.panel} ${s.fields}`} aria-labelledby="elo-2">
          <h2 id="elo-2" className={s.h2}><span className={s.step}>2</span>Elérhetőségeid</h2>
          <Field id="elo-name" label="Teljes név" icon={ICONS.user} value={values.name} onChange={set('name')} onBlur={leave('name')}
            error={errorOf('name')} ok={okOf('name')} maxLength={120} autoComplete="name" enterKeyHint="next" />
          <Field id="elo-email" label="E-mail cím" icon={ICONS.mail} type="email" inputMode="email" value={values.email} onChange={set('email')} onBlur={leave('email')}
            error={errorOf('email')} ok={okOf('email')} autoComplete="email" autoCapitalize="none" enterKeyHint="next" />
          <Field id="elo-phone" label="Telefonszám" icon={ICONS.phone} hint="Pl. +36 30 123 4567 – ezen hívunk, ha megérkezett." type="tel" inputMode="tel"
            value={values.phone} onChange={set('phone')} onBlur={leave('phone')} error={errorOf('phone')} ok={okOf('phone')} maxLength={25} autoComplete="tel" enterKeyHint="done" />
          {/* Robotcsapda: a látogatók nem látják */}
          <input type="text" name="website" value={values.website} onChange={set('website')} tabIndex={-1} autoComplete="off" aria-hidden="true" className={s.trap} />
          {formError && <div className={s.formError} role="alert">{formError}</div>}
          <p className={s.privacy}>
            A nevedet, az e-mail címedet és a telefonszámodat csak a bolt munkatársai látják. Kizárólag az előrendelés intézéséhez (értesítés, átvétel) használjuk, harmadik félnek nem adjuk át, és az előrendelés lezárása után legfeljebb 6 hónappal automatikusan töröljük.
            {process.env.NEXT_PUBLIC_PRIVACY_URL && <> <a href={process.env.NEXT_PUBLIC_PRIVACY_URL} target="_blank" rel="noopener noreferrer">Adatkezelési tájékoztató</a></>}
          </p>
        </section>

        {/* Telefonon alul ragad: végösszeg és beküldés */}
        <div className={s.bottom} data-sav-alul>
          {totalPrice !== null && (
            <div className={s.total}>
              <span>Végösszeg{hasUnpriced ? ' (ár nélküliek nélkül)' : ''}</span>
              <b key={totalPrice} data-osszeg>{formatPrice(totalPrice)}</b>
            </div>
          )}
          <SubmitButton busy={submitting} busyText="Küldés…">{chosen.length > 1 ? `Előrendelés leadása (${chosen.length} termék)` : 'Előrendelés leadása'}</SubmitButton>
        </div>
      </form>
    </Shell>
  );
}
