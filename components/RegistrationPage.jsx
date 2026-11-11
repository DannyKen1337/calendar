"use client";
import { useState } from 'react';
import { getGameTheme } from '@/lib/gameThemes';
import { getGameConfig } from '@/lib/gameConfig';
import EmbedBridge from '@/components/EmbedBridge';
import { Field, ErrorSummary, SubmitButton, Success, ICONS } from '@/components/FormKit';
import s from './RegistrationPage.module.css';

// Külön, játékhoz tematikus jelentkezési oldal (/jelentkezes/[id]). A színeket a játék témája adja (lib/gameThemes.js),
// az űrlap elemei a FormKitből jönnek: úszó címke, ellenőrzés a mező elhagyásakor, pipa a jó mezőn,
// hibaösszesítő, animált siker. A felépítés (3 mező, adatkezelési szöveg) a régi.
const STORE_NAMES = { debrecen: 'Tavern Debrecen', miskolc: 'Tavern Miskolc', jatekceh: 'JátékCéh' };
const DEFAULT_LOGO = '/jatekok/egyeb.png';
const FIELDS = ['username', 'name', 'email'];
const LABELS = { username: 'Felhasználónév', name: 'Teljes név', email: 'E-mail cím' };

function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit' });
}

// Visszalépés: beágyazva az iframe előzményeiben lépünk vissza (oda, ahonnan a látogató jött), különben a naptárra
function goBack(embed) {
  if (window.history.length > 1) window.history.back();
  else window.location.href = embed ? '/embed' : '/';
}

// Egy mező hibája (üres szöveg: jó)
function check(field, value) {
  const v = value.trim();
  if (field === 'username') return v.length < 2 || v.length > 24 || !/^[\p{L}\p{N} ._-]+$/u.test(v) ? '2–24 karakter: betű, szám, szóköz, pont, aláhúzás vagy kötőjel.' : '';
  if (field === 'name') return v ? '' : 'Add meg a teljes neved.';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Érvényes e-mail címet adj meg (pl. nev@pelda.hu).';
}

export default function RegistrationPage({ event, embed = false, maintenance = false }) {
  const theme = getGameTheme(event?.category);
  const [values, setValues] = useState({ username: '', name: '', email: '' });
  const [touched, setTouched] = useState({}); // a már elhagyott mezők (azok hibája látszik)
  const [serverErrors, setServerErrors] = useState({});
  const [tries, setTries] = useState(0); // beküldési kísérletek (a hibaösszesítőhöz)
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { isQueue, username, mailSent }
  const [now] = useState(() => Date.now());

  const vars = { '--accent': theme.accent, '--accent-text': theme.accentText, '--panel': theme.panel, '--glow': theme.glow, background: theme.bg };
  const shell = (content) => (
    <main className={`${s.page} ${embed ? s.embed : ''}`} style={vars}>
      {embed && <EmbedBridge />}
      <div className={s.wrap}>{content}</div>
    </main>
  );

  if (maintenance) {
    return shell(
      <div className={`${s.panel} ${s.center}`}>
        <h1 className={s.title}>Karbantartás alatt</h1>
        <p>A jelentkezés átmenetileg nem elérhető. Kérjük, nézz vissza később!</p>
      </div>
    );
  }

  const logo = event.imageUrl || getGameConfig(event.category).logo || DEFAULT_LOGO;
  const store = STORE_NAMES[event.store || 'debrecen'] || 'Tavern';
  const isPast = new Date(event.date).getTime() < now;
  const isFull = !event.isOpenAttendance && event.current_players >= event.max_players;
  const eventId = String(event._id || event.id);

  const errorOf = (f) => serverErrors[f] || ((touched[f] || tries > 0) ? check(f, values[f]) : '');
  const okOf = (f) => !!values[f].trim() && !check(f, values[f]) && !serverErrors[f];
  const set = (f) => (e) => {
    setValues(v => ({ ...v, [f]: e.target.value }));
    if (serverErrors[f]) setServerErrors(err => ({ ...err, [f]: '' }));
  };
  const leave = (f) => () => { if (values[f]) setTouched(t => ({ ...t, [f]: true })); };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setTries(n => n + 1);
    if (FIELDS.some(f => check(f, values[f]))) return;
    setSubmitting(true);
    setFormError('');
    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType: 'JOIN_TOURNAMENT',
          payload: { tournamentId: eventId, username: values.username.trim(), name: values.name.trim(), email: values.email.trim().toLowerCase() },
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.error) {
        const msg = (data && data.error) || 'A jelentkezés most nem sikerült. Próbáld újra, vagy szólj a szervezőnek.';
        if (data?.field) setServerErrors(err => ({ ...err, [data.field]: msg }));
        else setFormError(msg);
        return;
      }
      setResult({ isQueue: data.isQueue, username: data.username, mailSent: data.mailSent });
    } catch {
      setFormError('Hálózati hiba történt. Ellenőrizd az internetkapcsolatot, és próbáld újra.');
    } finally {
      setSubmitting(false);
    }
  };

  const header = (
    <header className={s.head}>
      <span className={s.logo}><img src={logo} alt={event.category || ''} onError={(e) => { e.currentTarget.src = DEFAULT_LOGO; }} /></span>
      <p className={s.kicker}>{store} · {event.category || 'Esemény'}</p>
      <h1 className={s.title}>{event.name}</h1>
      <p className={s.when}>{formatDate(event.date)}</p>
      {theme.tagline && <p className={s.tagline}>{theme.tagline}</p>}
    </header>
  );

  const backLinks = (
    <nav className={s.back} aria-label="Tovább">
      <button type="button" onClick={() => goBack(embed)}>‹ Vissza a naptárhoz</button>
      {!embed && <a href={`/esemeny/${encodeURIComponent(eventId)}`}>Esemény részletei</a>}
    </nav>
  );

  // Sikeres jelentkezés
  if (result) {
    return shell(
      <>
        {header}
        <div className={s.panel}>
          <Success title={result.isQueue ? 'Várólistára kerültél!' : 'Hely biztosítva!'} waiting={result.isQueue}>
            <p className={s.p}>A jelentkezők között így látszol: <b>{result.username}</b></p>
            {result.isQueue && <p className={s.muted}>Ha felszabadul egy hely, automatikusan előlépsz.</p>}
            {result.mailSent && <p className={s.muted}>A visszaigazolást elküldtük e-mailben.</p>}
            <a className={s.cta} href={`/api/export?event=${encodeURIComponent(eventId)}`}>Mentés a naptárba</a>
          </Success>
        </div>
        {backLinks}
      </>
    );
  }

  // Jelentkezés nem lehetséges: kötetlen létszám, külső jelentkezés, lezárt vagy elmúlt esemény
  let blocked = null;
  if (event.isOpenAttendance) blocked = 'Ehhez az eseményhez nincs jelentkezés – gyere el nyugodtan!';
  else if (isPast) blocked = 'Ez az esemény már lezajlott.';
  else if (!event.external_url && !event.is_open) blocked = 'A jelentkezés erre az eseményre lezárult.';

  if (blocked || event.external_url) {
    return shell(
      <>
        {header}
        <div className={`${s.panel} ${s.center}`}>
          {blocked ? <p className={s.p}>{blocked}</p> : (
            <>
              <p className={s.p}>Erre az eseményre a szervező oldalán lehet jelentkezni.</p>
              <a className={s.cta} href={event.external_url} target="_blank" rel="noopener noreferrer">Tovább a jelentkezéshez ↗</a>
            </>
          )}
        </div>
        {backLinks}
      </>
    );
  }

  const summary = tries > 0 ? FIELDS.filter(f => errorOf(f)).map(f => ({ id: `reg-${f}`, label: LABELS[f], message: errorOf(f) })) : [];
  const free = Math.max(0, event.max_players - event.current_players);

  return shell(
    <>
      {header}
      <form onSubmit={submit} noValidate className={`${s.panel} ${s.form}`}>
        <div className={s.capacity}>
          <div className={s.capRow}>
            <span>Létszám: <b>{event.current_players} / {event.max_players}</b></span>
            {isFull ? <span className={s.full}>Betelt – várólistára kerülsz</span> : <b>{free} hely szabad</b>}
          </div>
          <span className={s.capBar} data-sav aria-hidden="true"><span style={{ width: `${event.max_players ? Math.min(100, (event.current_players / event.max_players) * 100) : 0}%` }} /></span>
        </div>

        <ErrorSummary items={summary} version={tries} />

        <Field id="reg-username" label="Felhasználónév" icon={ICONS.badge} hint="Ez jelenik meg nyilvánosan a jelentkezők között."
          value={values.username} onChange={set('username')} onBlur={leave('username')} error={errorOf('username')} ok={okOf('username')}
          maxLength={24} autoComplete="nickname" autoCapitalize="none" enterKeyHint="next" />
        <Field id="reg-name" label="Teljes név" icon={ICONS.user} hint="Csak a szervezők látják."
          value={values.name} onChange={set('name')} onBlur={leave('name')} error={errorOf('name')} ok={okOf('name')}
          maxLength={120} autoComplete="name" enterKeyHint="next" />
        <Field id="reg-email" label="E-mail cím" icon={ICONS.mail} hint="Csak a szervezők látják. Ezzel tudsz később leiratkozni."
          type="email" inputMode="email" value={values.email} onChange={set('email')} onBlur={leave('email')} error={errorOf('email')} ok={okOf('email')}
          autoComplete="email" autoCapitalize="none" enterKeyHint="send" />

        {formError && <div className={s.formError} role="alert">{formError}</div>}

        <SubmitButton busy={submitting} busyText="Jelentkezés…">{isFull ? 'Jelentkezés várólistára' : 'Jelentkezem'}</SubmitButton>

        <p className={s.privacy}>
          A felhasználóneved nyilvánosan megjelenik a jelentkezők között. A teljes nevedet és az e-mail címedet csak a szervezők látják, kizárólag az esemény szervezéséhez (jelentkezés, visszaigazolás, leiratkozás) használjuk, harmadik félnek nem adjuk át, és az esemény után legfeljebb 2 hónappal automatikusan töröljük. A helyszíni megjelenést (megjelent / nem jelent meg) a szervezők rögzíthetik; ezt az e-mail címedhez kötve legfeljebb 1 évig őrizzük, kizárólag a meg nem jelenések kezeléséhez.
          {process.env.NEXT_PUBLIC_PRIVACY_URL && <> <a href={process.env.NEXT_PUBLIC_PRIVACY_URL} target="_blank" rel="noopener noreferrer">Adatkezelési tájékoztató</a></>}
        </p>
      </form>
      {backLinks}
    </>
  );
}
