import s from '@/weblap/fooldal.module.css';

// Az asztalfoglalás jelképe: arany „FOGLALT” asztali tábla. A Boltok részen az asztalon ringatózik, az
// asztalfoglaló ablakban (Overlays) ez billen fel a kattintás helyéről, és ebből nyílik ki a foglalás.
export default function TableTent({ className = '' }) {
  return (
    <div className={`${s.tent} ${className}`} aria-hidden="true" data-tabla>
      {/* csak a felirat: az apró, ritkított „Tavern” / „Neked tartjuk” sor kikerült (2026-11-28, díszítések nélkül) */}
      <div className={s.tentFace}>
        <b>Foglalt</b>
      </div>
    </div>
  );
}
