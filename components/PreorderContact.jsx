"use client";
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Field, SubmitButton, ICONS } from '@/components/FormKit';
import s from './PreorderPage.module.css';

// „Kérdésed van? Írj nekünk” az előrendelő oldal tetején: név, e-mail cím és üzenet; a bolt postafiókjába megy
// (/api/preorders/contact), a válasz a megadott e-mail címre érkezik. initial: az előrendelő űrlapba már beírt név / e-mail.
const FIELDS = ['name', 'email', 'message'];
// animálható-e (csökkentett mozgásnál és Web Animations nélkül azonnal nyílik / zárul)
const canAnimate = () => typeof window !== 'undefined' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches && 'animate' in Element.prototype;

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
  // Nyitás és zárás, mint egy Mac app: az űrlap abból a gombból nő ki, amelyre kattintottak, és bezáráskor oda húzódik
  // vissza (a felhasználó kérése). Közben a helye (és így az alatta lévő tartalom) ugyanabban a ritmusban nő / csökken.
  // phase: 'zarva' (a gomb látszik) · 'nyitva' · 'zarul' (a visszahúzódás alatt)
  const [phase, setPhase] = useState('zarva');
  const [back, setBack] = useState(false); // bezárás után a gomb újra megjelenik, és rá kerül a fókusz
  const [values, setValues] = useState({ name: '', email: '', message: '', website: '' });
  const [touched, setTouched] = useState({});
  const [tried, setTried] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const btnRef = useRef(null);
  const foldRef = useRef(null);
  const panelRef = useRef(null);
  const origin = useRef(null); // a gomb helye és mérete az űrlaphoz képest (ide nő ki / ide húzódik vissza)

  const show = () => {
    setValues(v => ({ ...v, name: v.name || initial.name || '', email: v.email || initial.email || '' }));
    setSentTo('');
    const r = btnRef.current?.getBoundingClientRect();
    origin.current = r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
    setPhase('nyitva');
  };
  // kinyílás: az űrlap a gomb helyéről és méretéről nő teljes méretre (a gomb ott volt, ahol most az űrlap kezdődik)
  useLayoutEffect(() => {
    if (phase !== 'nyitva' || !origin.current) return;
    const o = origin.current; const panel = panelRef.current; const fold = foldRef.current;
    const p = panel?.getBoundingClientRect();
    origin.current = p ? { dx: o.left - p.left, dy: o.top - p.top, width: o.width, height: o.height } : null;
    document.getElementById('kerdes-name')?.focus({ preventScroll: true });
    if (!p || !canAnimate()) return;
    const from = `translate(${o.left - p.left}px, ${o.top - p.top}px) scale(${o.width / p.width}, ${o.height / p.height})`;
    const timing = { duration: 420, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' };
    panel.animate([{ transform: from, opacity: 0 }, { opacity: 1, offset: 0.3 }, { transform: 'none', opacity: 1 }], timing);
    fold.style.overflow = 'hidden';
    fold.animate([{ height: `${o.height}px` }, { height: `${fold.offsetHeight}px` }], timing).finished.then(() => { fold.style.overflow = ''; }, () => {});
  }, [phase]);
  const hide = () => {
    setBack(true);
    const panel = panelRef.current; const fold = foldRef.current; const o = origin.current;
    if (!panel || !fold || !o || !canAnimate()) { setPhase('zarva'); return; }
    setPhase('zarul');
    const p = panel.getBoundingClientRect();
    const to = `translate(${o.dx}px, ${o.dy}px) scale(${o.width / p.width}, ${o.height / p.height})`;
    const timing = { duration: 300, easing: 'cubic-bezier(0.7, 0, 0.84, 0)', fill: 'forwards' };
    fold.style.overflow = 'hidden';
    Promise.all([
      panel.animate([{ transform: 'none', opacity: 1 }, { opacity: 1, offset: 0.6 }, { transform: to, opacity: 0 }], timing).finished,
      fold.animate([{ height: `${fold.offsetHeight}px` }, { height: `${o.height}px` }], timing).finished,
    ]).catch(() => {}).finally(() => setPhase('zarva'));
  };
  useEffect(() => {
    if (phase === 'zarva' && back) btnRef.current?.focus({ preventScroll: true });
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
      <button ref={btnRef} type="button" className={`${s.contactBtn} ${onGold ? s.contactBtnOnGold : ''} ${back ? s.contactBtnBack : ''}`} onClick={show} aria-expanded="false" aria-controls="kerdes" data-kerdes-gomb>
        <span className={s.contactIcon} aria-hidden="true">{ICONS.mail}</span><span>Kérdésed van? Írj nekünk</span>
      </button>
    );
  }

  return (
    <div ref={foldRef} className={s.contactFold} data-allapot={phase} data-kerdes-ablak>
    <div className={s.contactFoldInner}>
    <section ref={panelRef} id="kerdes" className={`${s.panel} ${s.contact}`} aria-labelledby="kerdes-cim" data-kerdes>
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
