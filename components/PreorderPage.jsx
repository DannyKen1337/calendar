"use client";
import { useState } from 'react';
import Link from 'next/link';
import { getGameConfig, getGameColor } from '@/lib/gameConfig';
import { groupByGame, maxSelectable, formatPrice } from '@/lib/preorders';

const ACCENT = '#E5B15D';
const DEFAULT_LOGO = 'https://cdn-icons-png.flaticon.com/512/6729/6729800.png';
const inputClass = 'w-full rounded-xl border-2 bg-black/40 px-4 py-3 text-white placeholder:text-[#8d8478] outline-none transition-colors focus:border-[#E5B15D]';

const Shell = ({ children }) => (
  <main className="min-h-screen py-10 px-4 flex justify-center items-start bg-[#121212] text-[#E8E2D6]">
    <div className="w-full max-w-2xl">{children}</div>
  </main>
);

const Panel = ({ children, className = '' }) => (
  <div className={`rounded-3xl border-2 p-6 md:p-8 bg-[#1a1012] ${className}`} style={{ borderColor: `${ACCENT}55`, boxShadow: `0 0 60px ${ACCENT}1a` }}>{children}</div>
);

const Header = ({ subtitle }) => (
  <div className="text-center mb-6">
    <p className="uppercase tracking-[0.25em] text-xs mb-2" style={{ color: ACCENT }}>Tavern</p>
    <h1 className="text-3xl md:text-4xl font-bold font-serif m-0 text-white">Előrendelés</h1>
    {subtitle && <p className="mt-2 mb-0 text-[#cfc6b8]">{subtitle}</p>}
  </div>
);

// Darabszám: gombokkal vagy beírással, 1 és a termékre érvényes felső határ között
function QuantityStepper({ value, onChange, label, max }) {
  const btn = 'w-9 h-9 rounded-lg border border-[#4A2E33] bg-[#2B1A1C] text-[#E0D6C8] text-lg font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
  return (
    <div className="flex items-center gap-2 shrink-0" role="group" aria-label={`${label}: darabszám`}>
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="Kevesebb">−</button>
      <input
        type="number" inputMode="numeric" min={1} max={max} value={value}
        onChange={(e) => { const n = parseInt(e.target.value, 10); if (Number.isFinite(n)) onChange(n); }}
        aria-label={`${label}: darabszám`}
        className="w-14 h-9 rounded-lg border border-[#4A2E33] bg-black/40 text-center text-white font-bold outline-none focus:border-[#E5B15D] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Több">+</button>
      <span className="text-sm text-[#cfc6b8]">db</span>
    </div>
  );
}

// Nyilvános előrendelő (feliratkozási) oldal. focusId: a megosztott linkben megadott termék (?termek=...),
// ilyenkor csak az a termék látszik, előre kiválasztva.
export default function PreorderPage({ products = [], focusId = null, maintenance = false, loadError = false }) {
  const focused = focusId ? products.find(p => p.id === focusId) : null;
  const shown = focused ? [focused] : products;
  const [selected, setSelected] = useState(() => (focused && maxSelectable(focused, focused.remaining) > 0 ? { [focused.id]: 1 } : {}));
  const [values, setValues] = useState({ name: '', email: '', phone: '', website: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  if (maintenance) {
    return <Shell><Header /><Panel className="text-center"><p className="m-0 text-lg">Az előrendelés átmenetileg nem elérhető. Kérjük, nézz vissza később!</p></Panel></Shell>;
  }
  if (loadError) {
    return <Shell><Header /><Panel className="text-center"><p className="m-0 text-lg">Az oldal most nem tölthető be. Kérjük, próbáld újra pár perc múlva.</p></Panel></Shell>;
  }

  const notFoundNotice = focusId && !focused && (
    <div className="rounded-xl px-4 py-3 mb-4 text-sm" style={{ background: '#faad1422', color: '#ffd591', border: '1px solid #faad1455' }}>
      Ennek a terméknek az előrendelése már lezárult, vagy a link hibás.{products.length > 0 ? ' Alább a jelenleg nyitott előrendeléseket látod.' : ''}
    </div>
  );

  if (products.length === 0) {
    return (
      <Shell>
        <Header />
        {notFoundNotice}
        <Panel className="text-center"><p className="m-0 text-lg">Jelenleg nincs nyitott előrendelés.</p></Panel>
      </Shell>
    );
  }

  const chosen = shown.filter(p => selected[p.id]);
  // Végösszeg a kiválasztott, árral rendelkező termékekből (null, ha egyiknek sincs ára)
  const priced = chosen.filter(p => p.price !== null && p.price !== undefined);
  const totalPrice = priced.length ? priced.reduce((s, p) => s + p.price * selected[p.id], 0) : null;
  const hasUnpriced = priced.length > 0 && priced.length < chosen.length;
  const toggle = (id) => {
    setSelected(s => { const next = { ...s }; if (next[id]) delete next[id]; else next[id] = 1; return next; });
    if (errors.items) setErrors(err => ({ ...err, items: '' }));
  };
  const maxOf = (id) => { const p = shown.find(x => x.id === id); return p ? maxSelectable(p, p.remaining) : 1; };
  const setQty = (id, qty) => setSelected(s => ({ ...s, [id]: Math.min(maxOf(id), Math.max(1, qty)) }));
  const set = (field) => (e) => {
    setValues(v => ({ ...v, [field]: e.target.value }));
    if (errors[field]) setErrors(err => ({ ...err, [field]: '' }));
  };

  const validate = () => {
    const err = {};
    if (chosen.length === 0) err.items = 'Válassz legalább egy terméket.';
    if (!values.name.trim()) err.name = 'Add meg a teljes neved.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) err.email = 'Érvényes e-mail címet adj meg.';
    const digits = values.phone.replace(/\D/g, '').length;
    if (!/^\+?[\d ()/-]{6,25}$/.test(values.phone.trim()) || digits < 6 || digits > 15) err.phone = 'Érvényes telefonszámot adj meg (pl. +36 30 123 4567).';
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting || !validate()) return;
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
        if (data?.field) setErrors(err => ({ ...err, [data.field]: msg }));
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
        <Panel className="text-center">
          <div className="text-5xl mb-3">🎉</div>
          <h2 className="text-2xl font-bold font-serif m-0" style={{ color: ACCENT }}>Köszönjük, megkaptuk az előrendelésed!</h2>
          <ul className="list-none p-0 mt-4 mb-0 flex flex-col gap-1">
            {result.items.map(i => <li key={i.name}><b className="text-white">{i.name}</b> – {i.quantity} db{i.price !== null && i.price !== undefined ? ` × ${formatPrice(i.price)}` : ''}</li>)}
          </ul>
          {result.total !== null && <p className="text-lg mt-3 mb-0">Végösszeg: <b className="text-white">{formatPrice(result.total)}</b></p>}
          {result.updated > 0 && <p className="text-[#cfc6b8] mt-4 mb-0">Erre a termékre ezzel az e-mail címmel már volt előrendelésed, azt frissítettük.</p>}
          <p className="text-[#cfc6b8] mt-4 mb-0">Amikor a termék megérkezik, a megadott elérhetőségeiden keresünk.{result.mailSent ? ' A visszaigazolást elküldtük e-mailben.' : ''}</p>
        </Panel>
        <div className="flex flex-wrap justify-center gap-4 mt-6 text-sm">
          <Link href="/" className="underline text-[#cfc6b8]">Eseménynaptár</Link>
        </div>
      </Shell>
    );
  }

  const fieldBorder = (field) => ({ borderColor: errors[field] ? '#ff6b6b' : 'rgba(255,255,255,0.15)' });

  return (
    <Shell>
      <Header subtitle={focused ? 'Add meg az adataidat, és jelezd, hány darabot kérsz.' : 'Válaszd ki, mire szeretnél feliratkozni, és add meg az elérhetőségeidet.'} />
      {notFoundNotice}
      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        <Panel>
          <h2 className="text-xl font-bold font-serif mt-0 mb-4" style={{ color: ACCENT }}>1. Mit szeretnél előrendelni?</h2>
          <div className="flex flex-col gap-6">
            {groupByGame(shown).map(({ game, items }) => (
              <section key={game} aria-label={game}>
                <div className="flex items-center gap-3 mb-3">
                  <img src={getGameConfig(game).logo || DEFAULT_LOGO} alt="" className="w-8 h-8 object-contain" onError={(e) => { e.currentTarget.src = DEFAULT_LOGO; }} />
                  <h3 className="m-0 text-lg font-bold" style={{ color: getGameColor({ category: game }) === '#6b7280' ? '#E0D6C8' : getGameColor({ category: game }) }}>{game}</h3>
                </div>
                <div className="flex flex-col gap-3">
                  {items.map(p => {
                    const isOn = !!selected[p.id];
                    const max = maxSelectable(p, p.remaining);
                    const soldOut = max === 0;
                    return (
                      <div key={p.id} className="rounded-2xl border-2 p-4 flex flex-col sm:flex-row sm:items-center gap-3 transition-colors" style={{ borderColor: isOn ? ACCENT : '#4A2E33', background: isOn ? '#2B1A1C' : '#160d0f', opacity: soldOut ? 0.6 : 1 }}>
                        <label className={`flex items-start gap-3 flex-1 min-w-0 ${soldOut ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input type="checkbox" checked={isOn} disabled={soldOut} onChange={() => toggle(p.id)} className="mt-1 w-5 h-5 shrink-0 accent-[#E5B15D] cursor-pointer disabled:cursor-not-allowed" />
                          <span className="min-w-0">
                            <span className="block text-white font-bold text-lg" style={{ overflowWrap: 'anywhere' }}>{p.name}</span>
                            {p.price !== null && p.price !== undefined && <span className="block font-bold" style={{ color: ACCENT }}>{formatPrice(p.price)}{isOn && selected[p.id] > 1 ? <span className="font-normal text-[#cfc6b8]"> · {selected[p.id]} db: {formatPrice(p.price * selected[p.id])}</span> : null}</span>}
                            {soldOut && <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#ff6b6b33', color: '#ffb3b3' }}>Elfogyott</span>}
                            {p.releaseDate && <span className="block text-sm" style={{ color: ACCENT }}>Megjelenés: {p.releaseDate}</span>}
                            {!soldOut && (p.perPersonLimit > 0 || p.remaining !== null) && (
                              <span className="block text-sm text-[#cfc6b8]">
                                {[p.perPersonLimit > 0 && `Személyenként legfeljebb ${p.perPersonLimit} db`, p.remaining !== null && `Még ${p.remaining} db foglalható`].filter(Boolean).join(' · ')}
                              </span>
                            )}
                            {p.description && <span className="block text-sm text-[#cfc6b8] mt-1 whitespace-pre-wrap">{p.description}</span>}
                          </span>
                        </label>
                        {isOn && <QuantityStepper value={selected[p.id]} onChange={(q) => setQty(p.id, q)} label={p.name} max={max} />}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          {errors.items && <p className="text-sm text-[#ff6b6b] mt-3 mb-0">{errors.items}</p>}
        </Panel>

        <Panel className="flex flex-col gap-5">
          <h2 className="text-xl font-bold font-serif m-0" style={{ color: ACCENT }}>2. Elérhetőségeid</h2>
          <label className="flex flex-col gap-2">
            <span className="font-bold text-white">Teljes név</span>
            <input className={inputClass} style={fieldBorder('name')} value={values.name} onChange={set('name')} placeholder="Vezetéknév Keresztnév" maxLength={120} autoComplete="name" />
            {errors.name && <span className="text-sm text-[#ff6b6b]">{errors.name}</span>}
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-bold text-white">E-mail cím</span>
            <input className={inputClass} style={fieldBorder('email')} type="email" inputMode="email" value={values.email} onChange={set('email')} placeholder="nev@pelda.hu" autoComplete="email" />
            {errors.email && <span className="text-sm text-[#ff6b6b]">{errors.email}</span>}
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-bold text-white">Telefonszám</span>
            <input className={inputClass} style={fieldBorder('phone')} type="tel" inputMode="tel" value={values.phone} onChange={set('phone')} placeholder="+36 30 123 4567" maxLength={25} autoComplete="tel" />
            {errors.phone && <span className="text-sm text-[#ff6b6b]">{errors.phone}</span>}
          </label>
          {/* Robotcsapda: a látogatók nem látják */}
          <input type="text" name="website" value={values.website} onChange={set('website')} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

          {formError && <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#ff6b6b22', color: '#ffb3b3', border: '1px solid #ff6b6b55' }}>{formError}</div>}

          {totalPrice !== null && (
            <div className="flex items-baseline justify-between gap-3 rounded-xl px-4 py-3" style={{ background: '#2B1A1C', border: '1px solid #4A2E33' }}>
              <span className="text-[#cfc6b8]">Végösszeg{hasUnpriced ? ' (az ár nélküli termékek nélkül)' : ''}</span>
              <b className="text-xl" style={{ color: ACCENT }}>{formatPrice(totalPrice)}</b>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full py-4 text-lg font-bold cursor-pointer border-none transition-transform hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-wait"
            style={{ background: ACCENT, color: '#1a1012', boxShadow: `0 8px 30px ${ACCENT}55` }}
          >
            {submitting ? 'Küldés...' : chosen.length > 1 ? `Előrendelés leadása (${chosen.length} termék)` : 'Előrendelés leadása'}
          </button>

          <p className="text-xs text-[#9a9186] m-0 leading-relaxed">
            A nevedet, az e-mail címedet és a telefonszámodat csak a bolt munkatársai látják. Kizárólag az előrendelés intézéséhez (értesítés, átvétel) használjuk, harmadik félnek nem adjuk át, és az előrendelés lezárása után legfeljebb 6 hónappal automatikusan töröljük.
            {process.env.NEXT_PUBLIC_PRIVACY_URL && <> <a href={process.env.NEXT_PUBLIC_PRIVACY_URL} target="_blank" rel="noopener noreferrer" style={{ color: ACCENT }}>Adatkezelési tájékoztató</a></>}
          </p>
        </Panel>
      </form>
    </Shell>
  );
}
