"use client";
import { useEffect, useRef, useState } from 'react';
import { createDice } from '@/lib/d20';
import s from './DiceRoll.module.css';

// Eldobott 3D dobókocka (lib/d20.js) a betöltő képernyőkhöz: az admin üdvözlő képernyője (AdminLoading) és a nyilvános
// naptár betöltése (BoosterLoading, véletlenszerűen a booster helyett). Minden dobás véletlen 1–20; ha 20-ast dob,
// szikraeső és „Natural 20!” felirat (easter egg). delay: csak ennyi ms után jelenik meg és dob (rövid betöltésnél
// így fel sem villan). Csökkentett mozgásnál álló kép. A teszthez a dobás eredménye rögzíthető: window.__D20_FORCE__.
export default function DiceRoll({ delay = 0, className = '' }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(delay <= 0);
  const [crit, setCrit] = useState(false);

  useEffect(() => {
    if (shown) return undefined;
    const t = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(t);
  }, [shown, delay]);

  useEffect(() => {
    if (!shown || !ref.current) return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cinzel = getComputedStyle(ref.current).getPropertyValue('--font-cinzel').trim();
    const forced = () => { const n = Number(window.__D20_FORCE__); return n >= 1 && n <= 20 ? n : 1 + Math.floor(Math.random() * 20); };
    return createDice(ref.current, {
      reduced,
      font: cinzel ? `${cinzel}, Georgia, serif` : 'Georgia, serif',
      pick: forced,
      onResult: (n) => { if (ref.current) ref.current.dataset.dobas = String(n); setCrit(n === 20); },
      onThrow: () => setCrit(false),
    });
  }, [shown]);

  if (!shown) return <div className={`${s.wrap} ${className}`} aria-hidden="true" />;
  return (
    <div className={`${s.wrap} ${s.shown} ${className}`}>
      <canvas ref={ref} className={s.canvas} aria-hidden="true" data-kocka />
      <p className={`${s.crit} ${crit ? s.critOn : ''}`} aria-live="polite" data-natural20={crit ? '1' : undefined}>{crit ? 'Natural 20! Kritikus siker!' : ''}</p>
    </div>
  );
}
