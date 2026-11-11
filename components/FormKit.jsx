"use client";
import { useEffect, useRef, useState } from 'react';
import s from './FormKit.module.css';

// Közös űrlapelemek a jelentkezési és az előrendelő oldalhoz (a UI UX Pro Max szabályai szerint): úszó címke ikonnal,
// magyarázat és hiba a mezőhöz kötve (aria-describedby), hibánál rázkódás, jó mezőn pipa; haladásjelző; hibaösszesítő a
// sikertelen beküldés után (ráugrik a fókusz, linkek a mezőkre); gomb töltésjelzővel; siker kirajzolódó pipával és rövid
// konfettivel. A színeket a szülő adja CSS-változókkal (--accent, --accent-text, --panel). Csökkentett mozgásnál nincs animáció.

const CHECK = 'M5 12.5l4.2 4.2L19 7';

// Egy mező. error: a hibaüzenet (csak ha a mezőt már elhagyták, vagy beküldték); ok: kitöltve és jó
export function Field({ id, label, icon, hint, error, ok, ...input }) {
  const describedBy = [hint && `tipp-${id}`, error && `hiba-${id}`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={s.field} data-mezo data-allapot={error ? 'hiba' : ok ? 'jo' : undefined}>
      <div className={s.box}>
        {icon && <span className={s.icon} aria-hidden="true">{icon}</span>}
        <input id={id} className={s.input} placeholder=" " aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
        <label htmlFor={id} className={s.label}>{label}</label>
        {ok && !error && <span className={s.ok} data-jo aria-hidden="true"><svg viewBox="0 0 24 24"><path d={CHECK} /></svg></span>}
      </div>
      {hint && <p id={`tipp-${id}`} className={s.hint}>{hint}</p>}
      {error && <p id={`hiba-${id}`} className={s.error}>{error}</p>}
    </div>
  );
}

// Mennyi van kész (pl. 2 / 3)
export function Progress({ done, total }) {
  return (
    <div className={s.progress} data-haladas>
      <span className={s.progressText}><b>{done} / {total}</b> kész</span>
      <span className={s.progressBar} aria-hidden="true"><span style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></span>
    </div>
  );
}

// Hibaösszesítő a sikertelen beküldés után: ráugrik a fókusz; a linkek a hibás mezőre visznek
// items: [{ id, label, message }]; version: minden beküldéskor más, hogy újra ráugorjon a fókusz
export function ErrorSummary({ items, version }) {
  const ref = useRef(null);
  useEffect(() => { if (items.length) ref.current?.focus(); }, [version]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!items.length) return null;
  const go = (ev, id) => { ev.preventDefault(); const el = document.getElementById(id); el?.focus(); el?.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
  return (
    <div ref={ref} className={s.summary} role="alert" tabIndex={-1} data-hibak>
      <b>Még {items.length} dolgot kell javítanod:</b>
      <ul>{items.map(it => <li key={it.id}><a href={`#${it.id}`} onClick={(ev) => go(ev, it.id)}>{it.label}: {it.message}</a></li>)}</ul>
    </div>
  );
}

// Beküldés gomb: töltés közben pörgő jel és aria-busy
export function SubmitButton({ busy, busyText, children, ...rest }) {
  return (
    <button type="submit" className={s.submit} disabled={busy} aria-busy={busy || undefined} {...rest}>
      {busy && <span className={s.spinner} aria-hidden="true" />}
      <span>{busy ? busyText : children}</span>
    </button>
  );
}

// Siker: kirajzolódó pipa (homokóra, ha várólistás) és rövid konfetti
export function Success({ title, waiting = false, children }) {
  // A siker csak beküldés után, a böngészőben jelenik meg, így a beállítás rögtön kiolvasható
  const [motion] = useState(() => typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  return (
    <div className={s.success} role="status">
      {motion && (
        <div className={s.confetti} aria-hidden="true">
          {Array.from({ length: 24 }, (_, i) => <i key={i} data-konfetti style={{ '--x': `${(i * 37) % 100}%`, '--d': `${(i % 6) * 60}ms`, '--r': `${(i * 47) % 360}deg`, '--c': i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? 'var(--accent)' : '#ffd98a' }} />)}
        </div>
      )}
      <svg className={s.mark} viewBox="0 0 52 52" aria-hidden="true" data-pipa>
        <circle cx="26" cy="26" r="24" />
        {waiting ? <path d="M18 14h16M18 38h16M19 14c0 7 14 7 14 12s-14 5-14 12M33 14c0 7-14 7-14 12s14 5 14 12" /> : <path d="M15 27l7.5 7.5L37.5 19" />}
      </svg>
      <h2 className={s.successTitle}>{title}</h2>
      {children}
    </div>
  );
}

// Ikonok (vonalas SVG, emoji helyett)
export const ICONS = {
  user: <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0 1 16 0" /></svg>,
  badge: <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="9" cy="11" r="2.5" /><path d="M14 10h4M14 14h4M6 16a3 3 0 0 1 6 0" /></svg>,
  mail: <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" /></svg>,
  phone: <svg viewBox="0 0 24 24"><path d="M6 3h3l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z" /></svg>,
};
