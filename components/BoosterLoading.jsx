"use client";
import { useEffect, useRef, useState } from 'react';
import s from './BoosterLoading.module.css';

// A nyilvános naptár betöltése (pl. hidegindításnál): egy Tavern booster lebeg, csillog, alatta váltakozó, élénkítő
// szöveg. Amikor megjön az adat, a booster teteje letépődik, a csomag lecsúszik, és „kijön belőle” a naptár.
// Csak lassú betöltésnél (hidegindítás) jelenik meg: ha 1,5 mp alatt megjön az adat, semmi nem látszik. Ha megjelent,
// és utána megjön az adat, rögtön letépődik (legfeljebb egy pillanatig tartjuk vissza, hogy ne villanjon).
// Csökkentett mozgásnál nincs tépés, csak elhalványul. loading: tölt-e még a naptár
const LINES = [
  'Keverjük a paklit…',
  'Felállítjuk az asztalokat…',
  'Kiosztjuk a lapokat…',
  'Behúzzuk a heti programot…',
  'Mindjárt kezdünk!',
];
const SHOW_AFTER = 1500;
const MIN_VISIBLE = 400;
const TEAR_MS = 1150;

export default function BoosterLoading({ loading }) {
  const [phase, setPhase] = useState('idle'); // idle → pack → tear → done
  const [line, setLine] = useState(0);
  const [slow, setSlow] = useState(false); // hosszabb hidegindítás: külön mondat
  const shownAt = useRef(0);

  // megjelenés csak akkor, ha a betöltés nem azonnali
  useEffect(() => {
    if (!loading) return undefined;
    const t = setTimeout(() => setPhase(p => { if (p !== 'idle') return p; shownAt.current = Date.now(); return 'pack'; }), SHOW_AFTER);
    const slowT = setTimeout(() => setSlow(true), 6000);
    return () => { clearTimeout(t); clearTimeout(slowT); };
  }, [loading]);

  // váltakozó szöveg
  useEffect(() => {
    if (phase !== 'pack') return undefined;
    const i = setInterval(() => setLine(n => (n + 1) % LINES.length), 1800);
    return () => clearInterval(i);
  }, [phase]);

  // kész az adat: tépés (ha látszott a booster)…
  useEffect(() => {
    if (loading || phase !== 'pack') return undefined;
    const wait = Math.max(0, shownAt.current + MIN_VISIBLE - Date.now());
    const t = setTimeout(() => { document.documentElement.dataset.boosterNyit = '1'; setPhase('tear'); }, wait);
    return () => clearTimeout(t);
  }, [loading, phase]);
  // …utána eltűnik (külön effekt, hogy a fázisváltás ne törölje az időzítőt)
  useEffect(() => {
    if (phase !== 'tear') return undefined;
    const t = setTimeout(() => { setPhase('done'); delete document.documentElement.dataset.boosterNyit; }, TEAR_MS);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => () => { delete document.documentElement.dataset.boosterNyit; }, []);

  if (phase === 'idle' || phase === 'done') return null;
  return (
    <div className={`${s.overlay} ${phase === 'tear' ? s.tearing : ''}`} role="status" aria-live="polite" data-booster={phase}>
      <div className={s.pack} aria-hidden="true">
        <div className={s.top}><span className={s.crimp} /></div>
        {/* a kiugró lapok a csomag teste mögött: tépéskor a nyíláson emelkednek ki */}
        <span className={s.cards}><i /><i /><i /></span>
        <div className={s.body}>
          <span className={s.sheen} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={s.logo} src="/weblapteszt/brand/tavern-ceger.png" alt="" width={1499} height={403} />
          <b className={s.packTitle}>Booster</b>
          <span className={s.packSub}>Eseménynaptár · heti kiadás</span>
          <span className={`${s.crimp} ${s.crimpBottom}`} />
        </div>
        <span className={s.burst} />
      </div>
      <p className={s.line} key={slow ? 'lassu' : line}>{slow ? 'Az első betöltés kicsit tovább tart, ébresztjük a szervert…' : LINES[line]}</p>
      <span className={s.sr}>A naptár betöltése folyamatban</span>
    </div>
  );
}
