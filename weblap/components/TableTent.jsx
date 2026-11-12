import s from '@/weblap/fooldal.module.css';

// Az asztalfoglalás jelképe: arany „FOGLALT” asztali tábla. A Boltok részen az asztalon ringatózik, az
// asztalfoglaló ablakban (Overlays) ez billen fel a kattintás helyéről, és ebből nyílik ki a foglalás.
export default function TableTent({ className = '' }) {
  return (
    <div className={`${s.tent} ${className}`} aria-hidden="true">
      <div className={s.tentFace}>
        <span>Tavern</span>
        <b>Foglalt</b>
        <i />
        <span>Neked tartjuk</span>
      </div>
    </div>
  );
}
