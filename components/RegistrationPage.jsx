"use client";
import { useState } from 'react';
import { getGameTheme } from '@/lib/gameThemes';
import { getGameConfig } from '@/lib/gameConfig';
import EmbedBridge from '@/components/EmbedBridge';

const STORE_NAMES = { debrecen: 'Tavern Debrecen', miskolc: 'Tavern Miskolc', jatekceh: 'JátékCéh' };
const DEFAULT_LOGO = 'https://cdn-icons-png.flaticon.com/512/6729/6729800.png';

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

export default function RegistrationPage({ event, embed = false, maintenance = false }) {
  const theme = getGameTheme(event?.category);
  const [values, setValues] = useState({ username: '', name: '', email: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { isQueue, username, mailSent }
  const [now] = useState(() => Date.now());

  const shell = (content) => (
    <main
      className={`${embed ? 'py-8' : 'min-h-screen py-10'} px-4 flex justify-center items-start`}
      style={{ background: theme.bg, color: '#E8E2D6', '--accent': theme.accent }}
    >
      {embed && <EmbedBridge />}
      <div className="w-full max-w-xl">{content}</div>
    </main>
  );

  const panelStyle = { background: theme.panel, borderColor: `${theme.accent}55`, boxShadow: `0 0 60px ${theme.glow}33` };

  if (maintenance) {
    return shell(
      <div className="rounded-3xl border-2 p-8 text-center backdrop-blur" style={panelStyle}>
        <h1 className="text-3xl font-bold font-serif mb-3" style={{ color: theme.accent }}>Karbantartás alatt 🛠️</h1>
        <p>A jelentkezés átmenetileg nem elérhető. Kérjük, nézz vissza később!</p>
      </div>
    );
  }

  const logo = event.imageUrl || getGameConfig(event.category).logo || DEFAULT_LOGO;
  const store = STORE_NAMES[event.store || 'debrecen'] || 'Tavern';
  const isPast = new Date(event.date).getTime() < now;
  const isFull = !event.isOpenAttendance && event.current_players >= event.max_players;
  const eventId = String(event._id || event.id);

  const set = (field) => (e) => {
    setValues(v => ({ ...v, [field]: e.target.value }));
    if (errors[field]) setErrors(err => ({ ...err, [field]: '' }));
  };

  const validate = () => {
    const err = {};
    const u = values.username.trim();
    if (u.length < 2 || u.length > 24 || !/^[\p{L}\p{N} ._-]+$/u.test(u)) err.username = '2-24 karakter: betű, szám, szóköz, pont, aláhúzás vagy kötőjel.';
    if (!values.name.trim()) err.name = 'Add meg a teljes neved.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) err.email = 'Érvényes e-mail címet adj meg.';
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting || !validate()) return;
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
        if (data?.field) setErrors(err => ({ ...err, [data.field]: msg }));
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
    <div className="flex flex-col items-center text-center mb-6">
      <div className="w-28 h-28 rounded-3xl p-3 flex items-center justify-center mb-4 border-2" style={{ background: '#0a0a0acc', borderColor: `${theme.accent}88`, boxShadow: `0 0 40px ${theme.glow}66` }}>
        <img src={logo} alt={event.category || ''} className="w-full h-full object-contain" onError={(e) => { e.currentTarget.src = DEFAULT_LOGO; }} />
      </div>
      <p className="uppercase tracking-[0.25em] text-xs mb-2" style={{ color: theme.accent }}>{store} · {event.category || 'Esemény'}</p>
      <h1 className="text-3xl md:text-4xl font-bold font-serif m-0 text-white break-words">{event.name}</h1>
      <p className="mt-2 mb-0 text-[#cfc6b8]">{formatDate(event.date)}</p>
      <p className="mt-3 mb-0 italic" style={{ color: theme.accent }}>{theme.tagline}</p>
    </div>
  );

  const backLinks = (
    <div className="flex flex-wrap justify-center gap-4 mt-6 text-sm">
      <button type="button" onClick={() => goBack(embed)} className="bg-transparent border-none cursor-pointer underline" style={{ color: '#cfc6b8' }}>← Vissza a naptárhoz</button>
      {!embed && <a href={`/esemeny/${encodeURIComponent(eventId)}`} className="underline" style={{ color: '#cfc6b8' }}>Esemény részletei</a>}
    </div>
  );

  // Sikeres jelentkezés
  if (result) {
    return shell(
      <>
        {header}
        <div className="rounded-3xl border-2 p-8 text-center backdrop-blur" style={panelStyle}>
          <div className="text-5xl mb-3">{result.isQueue ? '⏳' : '🎉'}</div>
          <h2 className="text-2xl font-bold font-serif m-0" style={{ color: theme.accent }}>{result.isQueue ? 'Várólistára kerültél!' : 'Hely biztosítva!'}</h2>
          <p className="mt-3">A jelentkezők között így látszol: <b className="text-white">{result.username}</b></p>
          {result.isQueue && <p className="text-[#cfc6b8]">Ha felszabadul egy hely, automatikusan előlépsz.</p>}
          {result.mailSent && <p className="text-[#cfc6b8]">A visszaigazolást elküldtük e-mailben.</p>}
        </div>
        {backLinks}
      </>
    );
  }

  // Jelentkezés nem lehetséges: kötetlen létszám, külső jelentkezés, lezárt vagy elmúlt esemény
  let blocked = null;
  if (event.isOpenAttendance) blocked = 'Ehhez az eseményhez nincs jelentkezés – kötetlen létszám, gyere el nyugodtan!';
  else if (isPast) blocked = 'Ez az esemény már lezajlott.';
  else if (!event.external_url && !event.is_open) blocked = 'A jelentkezés erre az eseményre lezárult.';

  if (blocked || event.external_url) {
    return shell(
      <>
        {header}
        <div className="rounded-3xl border-2 p-8 text-center backdrop-blur" style={panelStyle}>
          {blocked ? <p className="m-0 text-lg">{blocked}</p> : (
            <>
              <p className="mt-0">Erre az eseményre a szervező oldalán lehet jelentkezni.</p>
              <a href={event.external_url} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 px-7 py-3 rounded-full font-bold no-underline" style={{ background: theme.accent, color: theme.accentText }}>Tovább a jelentkezéshez</a>
            </>
          )}
        </div>
        {backLinks}
      </>
    );
  }

  const inputClass = 'w-full rounded-xl border-2 bg-black/40 px-4 py-3 text-white placeholder:text-[#8d8478] outline-none transition-colors focus:border-[var(--accent)]';
  const fieldBorder = (field) => ({ borderColor: errors[field] ? '#ff6b6b' : 'rgba(255,255,255,0.15)' });

  return shell(
    <>
      {header}
      <form onSubmit={submit} noValidate className="rounded-3xl border-2 p-6 md:p-8 backdrop-blur flex flex-col gap-5" style={panelStyle}>
        <div className="flex justify-between items-center text-sm text-[#cfc6b8]">
          <span>Létszám: <b className="text-white">{event.current_players} / {event.max_players}</b></span>
          {isFull && <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: '#faad1433', color: '#faad14' }}>Betelt – várólistára kerülsz</span>}
        </div>

        <label className="flex flex-col gap-2">
          <span className="font-bold text-white">1. Felhasználónév</span>
          <span className="text-xs text-[#cfc6b8]">Ez jelenik meg nyilvánosan a jelentkezők között (pl. a játékbeli neved).</span>
          <input className={inputClass} style={fieldBorder('username')} value={values.username} onChange={set('username')} placeholder="Pl.: KártyaMester" maxLength={24} autoComplete="nickname" autoFocus />
          {errors.username && <span className="text-sm text-[#ff6b6b]">{errors.username}</span>}
        </label>

        <label className="flex flex-col gap-2">
          <span className="font-bold text-white">2. Teljes név</span>
          <span className="text-xs text-[#cfc6b8]">Csak a szervezők látják.</span>
          <input className={inputClass} style={fieldBorder('name')} value={values.name} onChange={set('name')} placeholder="Pl.: Teszt Elek" maxLength={120} autoComplete="name" />
          {errors.name && <span className="text-sm text-[#ff6b6b]">{errors.name}</span>}
        </label>

        <label className="flex flex-col gap-2">
          <span className="font-bold text-white">3. E-mail cím</span>
          <span className="text-xs text-[#cfc6b8]">Csak a szervezők látják. Ezzel tudsz később leiratkozni.</span>
          <input className={inputClass} style={fieldBorder('email')} type="email" inputMode="email" value={values.email} onChange={set('email')} placeholder="pelda@email.com" autoComplete="email" />
          {errors.email && <span className="text-sm text-[#ff6b6b]">{errors.email}</span>}
        </label>

        {formError && <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#ff6b6b22', color: '#ffb3b3', border: '1px solid #ff6b6b55' }}>{formError}</div>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full py-4 text-lg font-bold cursor-pointer border-none transition-transform hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-wait"
          style={{ background: theme.accent, color: theme.accentText, boxShadow: `0 8px 30px ${theme.accent}55` }}
        >
          {submitting ? 'Jelentkezés...' : isFull ? 'Jelentkezés várólistára' : theme.cta}
        </button>

        <p className="text-xs text-[#9a9186] m-0 leading-relaxed">
          A felhasználóneved nyilvánosan megjelenik a jelentkezők között. A teljes nevedet és az e-mail címedet csak a szervezők látják, kizárólag az esemény szervezéséhez (jelentkezés, visszaigazolás, leiratkozás) használjuk, harmadik félnek nem adjuk át, és az esemény után legfeljebb 2 hónappal automatikusan töröljük. A helyszíni megjelenést (megjelent / nem jelent meg) a szervezők rögzíthetik; ezt az e-mail címedhez kötve legfeljebb 1 évig őrizzük, kizárólag a meg nem jelenések kezeléséhez.
          {process.env.NEXT_PUBLIC_PRIVACY_URL && <> <a href={process.env.NEXT_PUBLIC_PRIVACY_URL} target="_blank" rel="noopener noreferrer" style={{ color: theme.accent }}>Adatkezelési tájékoztató</a></>}
        </p>
      </form>
      {backLinks}
    </>
  );
}
