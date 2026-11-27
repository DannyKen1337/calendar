"use client";
import { useEffect, useRef, useState } from 'react';
import { createDice } from '@/lib/d20';
import { setDiceBusy } from '@/lib/loaderGate';
import s from './DiceRoll.module.css';

// Eldobott 3D dobókocka (lib/d20.js) a betöltő képernyőkhöz: az admin üdvözlő képernyője (AdminLoading) és a nyilvános
// naptár betöltése (BoosterLoading, véletlenszerűen a booster helyett). Minden dobás véletlen 1–20; ha 20-ast dob,
// szikraeső és „Natural 20!” felirat (easter egg). delay: csak ennyi ms után jelenik meg és dob (rövid betöltésnél
// így fel sem villan). Ha a dobás elkezdődött, a betöltő megvárja a végét (lib/loaderGate.js). Csökkentett mozgásnál
// álló kép. A teszthez a dobás eredménye rögzíthető: window.__D20_FORCE__.
// enabled: dobhat-e (az adminban csak belépéskor: lib/loaderGate.js); onShown: megjelent a kocka
export default function DiceRoll({ delay = 0, className = '', enabled = true, onShown }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(enabled && delay <= 0);
  const [crit, setCrit] = useState(false);

  useEffect(() => {
    if (shown || !enabled) return undefined;
    const t = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(t);
  }, [shown, delay, enabled]);

  const shownCb = useRef(onShown);
  useEffect(() => { shownCb.current = onShown; });
  useEffect(() => { if (shown) shownCb.current?.(); }, [shown]);

  useEffect(() => {
    if (!shown || !ref.current) return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cinzel = getComputedStyle(ref.current).getPropertyValue('--font-cinzel').trim();
    const forced = () => { const n = Number(window.__D20_FORCE__); return n >= 1 && n <= 20 ? n : 1 + Math.floor(Math.random() * 20); };
    const stop = createDice(ref.current, {
      reduced,
      font: cinzel ? `${cinzel}, Georgia, serif` : 'Georgia, serif',
      pick: forced,
      onResult: (n) => { if (ref.current) ref.current.dataset.dobas = String(n); setCrit(n === 20); },
      // amíg dob, a betöltő nem tűnik el (lib/loaderGate.js); a dobás végén elengedi
      onThrow: () => { setCrit(false); setDiceBusy(true); },
      onSettled: () => setDiceBusy(false),
    });
    return () => { stop(); setDiceBusy(false); };
  }, [shown]);

  if (!shown) return <div className={`${s.wrap} ${className}`} aria-hidden="true" />;
  return (
    <div className={`${s.wrap} ${s.shown} ${className}`}>
      <canvas ref={ref} className={s.canvas} aria-hidden="true" data-kocka />
      <p className={`${s.crit} ${crit ? s.critOn : ''}`} aria-live="polite" data-natural20={crit ? '1' : undefined}>{crit ? 'Natural 20! Kritikus siker!' : ''}</p>
    </div>
  );
}
