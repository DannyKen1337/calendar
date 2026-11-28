"use client";
import { useEffect, useState } from 'react';
import { Field, SubmitButton, ICONS } from '@/components/FormKit';
import s from './PreorderPage.module.css';

// „Kérdésed van? Írj nekünk” az előrendelő oldal tetején: név, e-mail cím és üzenet; a bolt postafiókjába megy
// (/api/preorders/contact), a válasz a megadott e-mail címre érkezik. initial: az előrendelő űrlapba már beírt név / e-mail.
const FIELDS = ['name', 'email', 'message'];

function check(field, value) {
  const v = value.trim();
  if (field === 'name') return v ? '' : 'Add meg a neved.';
  if (field === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Érvényes e-mail címet adj meg (pl. nev@pelda.hu).';
  if (v.length < 5) return 'Írd le röviden, miben segíthetünk.';
  return v.length > 3000 ? 'Az üzenet legfeljebb 3000 karakter lehet.' : '';
}

// source: 'weboldal' a weboldal „Írj nekünk” részében (a levél tárgya más); intro: a kinyíló űrlap első mondata;
// onGold: arany háttéren (a weboldal Kapcsolat sávja) sötét gomb
export default function PreorderContact({ productId = null, initial = {}, source = '', intro = '', onGold = false }) {
  // kinyíló / bezáródó űrlap (a felhasználó kérése): 'zarva' → (gomb) · 'nyilik' → 'nyitva' (lefelé kinyílik) · 'zarul' → 'zarva'
  const [phase, setPhase] = useState('zarva');
  const [back, setBack] = useState(false); // bezárás után a gomb rugózva tér vissza, és rá kerül a fókusz
  const [values, setValues] = useState({ name: '', email: '', message: '', website: '' });
  const [touched, setTouched] = useState({});
  const [tried, setTried] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState('');

  const show = () => {
    setValues(v => ({ ...v, name: v.name || initial.name || '', email: v.email || initial.email || '' }));
    setSentTo('');
    setPhase('nyilik');
    // két képkocka múlva nyílik (előbb összecsukva kerül a helyére, hogy legyen honnan kinyílnia)
    requestAnimationFrame(() => requestAnimationFrame(() => setPhase(p => (p === 'nyilik' ? 'nyitva' : p))));
    setTimeout(() => document.getElementById('kerdes-name')?.focus({ preventScroll: true }), 60);
  };
  const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const hide = () => {
    setBack(true);
    if (reduced()) { setPhase('zarva'); return; }
    setPhase('zarul');
  };
  // ha az áttűnés vége nem jönne (pl. háttérben lévő lap), legkésőbb fél másodperc múlva bezárul
  useEffect(() => {
    if (phase !== 'zarul') return undefined;
    const timer = setTimeout(() => setPhase('zarva'), 520);
    return () => clearTimeout(timer);
  }, [phase]);
  useEffect(() => {
    if (phase === 'zarva' && back) document.querySelector('[data-kerdes-gomb]')?.focus({ preventScroll: true });
  }, [phase, back]);
  const set = (f) => (e) => { setValues(v => ({ ...v, [f]: e.target.value })); if (serverErrors[f]) setServerErrors(x => ({ ...x, [f]: '' })); };
  const leave = (f) => () => { if (values[f]) setTouched(t => ({ ...t, [f]: true })); };
  const errorOf = (f) => serverErrors[f] || ((touched[f] || tried) ? check(f, values[f]) : '');
  const okOf = (f) => !!values[f].trim() && !check(f, values[f]) && !serverErrors[f];

  const send = async (e) => {
    e.preventDefault();
    if (sending) return;
    setTried(true);
    const bad = FIELDS.find(f => check(f, values[f]));
    if (bad) { document.getElementById(`kerdes-${bad}`)?.focus(); return; }
    setSending(true);
    setFormError('');
    try {
      const res = await fetch('/api/preorders/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: values.name.trim(), email: values.email.trim().toLowerCase(), message: values.message.trim(), website: values.website, ...(productId ? { productId } : {}), ...(source ? { source } : {}) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.error) {
        const msg = (data && data.error) || 'Az üzenet most nem ment el. Próbáld újra később.';
        if (data?.field) setServerErrors(x => ({ ...x, [data.field]: msg })); else setFormError(msg);
        return;
      }
      setSentTo(values.email.trim().toLowerCase());
      setValues(v => ({ ...v, message: '' }));
      setTried(false);
      setTouched({});
    } catch {
      setFormError('Hálózati hiba történt. Ellenőrizd az internetkapcsolatot, és próbáld újra.');
    } finally {
      setSending(false);
    }
  };

  if (phase === 'zarva') {
    return (
      <button type="button" className={`${s.contactBtn} ${onGold ? s.contactBtnOnGold : ''} ${back ? s.contactBtnBack : ''}`} onClick={show} aria-expanded="false" aria-controls="kerdes" data-kerdes-gomb>
        <span className={s.contactIcon} aria-hidden="true">{ICONS.mail}</span><span>Kérdésed van? Írj nekünk</span>
      </button>
    );
  }

  return (
    <div className={s.contactFold} data-allapot={phase} data-kerdes-ablak onTransitionEnd={(e) => { if (e.target === e.currentTarget && phase === 'zarul') setPhase('zarva'); }}>
    <div className={s.contactFoldInner}>
    <section id="kerdes" className={`${s.panel} ${s.contact}`} aria-labelledby="kerdes-cim" data-kerdes>
      <div className={s.contactHead}>
        <h2 id="kerdes-cim" className={s.h2}>Írj nekünk</h2>
        <button type="button" className={s.contactClose} onClick={hide} aria-label="Bezárás" aria-expanded="true" aria-controls="kerdes">×</button>
      </div>
      {sentTo ? (
        <div className={s.contactSent} role="status" data-kerdes-elkuldve>
          <p className={s.p}><b>Elküldtük az üzeneted!</b></p>
          <p className={s.muted}>Hamarosan válaszolunk a(z) <b>{sentTo}</b> címre.</p>
          <button type="button" className={s.secondary} onClick={() => setSentTo('')}>Új üzenet</button>
        </div>
      ) : (
        <form onSubmit={send} noValidate className={s.fields}>
          <p className={s.muted}>{intro || 'Kérdésed vagy problémád van az előrendeléssel? Írd meg, és a megadott e-mail címre válaszolunk.'}</p>
          <Field id="kerdes-name" label="Neved" icon={ICONS.user} value={values.name} onChange={set('name')} onBlur={leave('name')}
            error={errorOf('name')} ok={okOf('name')} maxLength={120} autoComplete="name" enterKeyHint="next" />
          <Field id="kerdes-email" label="E-mail címed" icon={ICONS.mail} type="email" inputMode="email" value={values.email} onChange={set('email')} onBlur={leave('email')}
            error={errorOf('email')} ok={okOf('email')} autoComplete="email" autoCapitalize="none" enterKeyHint="next" />
          <div className={s.msgField} data-allapot={errorOf('message') ? 'hiba' : undefined}>
            <label htmlFor="kerdes-message" className={s.msgLabel}>Üzenet</label>
            <textarea id="kerdes-message" className={s.msgInput} rows={5} maxLength={3000} value={values.message} onChange={set('message')} onBlur={leave('message')}
              aria-invalid={errorOf('message') ? true : undefined} aria-describedby={errorOf('message') ? 'hiba-kerdes-message' : undefined} />
            {errorOf('message') && <p id="hiba-kerdes-message" className={s.msgError}>{errorOf('message')}</p>}
          </div>
          {/* Robotcsapda: a látogatók nem látják */}
          <input type="text" name="website" value={values.website} onChange={set('website')} tabIndex={-1} autoComplete="off" aria-hidden="true" className={s.trap} />
          {formError && <div className={s.formError} role="alert">{formError}</div>}
          <SubmitButton busy={sending} busyText="Küldés…" data-kerdes-kuld>Üzenet küldése</SubmitButton>
        </form>
      )}
    </section>
    </div>
    </div>
  );
}
