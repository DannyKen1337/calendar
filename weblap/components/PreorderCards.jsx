"use client";
import { useRef, useState } from 'react';
import { formatPrice } from '@/lib/preorders';
import s from '@/weblap/fooldal.module.css';

// Az Előrendelés mező kártyái: az élő (nyitott) előrendelések, lüktető „ÉLŐ” jelzéssel. Kattintásra a kártya megnyomódik
// és felpattan, holografikus fény söpör végig rajta, a kattintás helyéről aranyszikrák és egy körhullám indul; utána
// ugyanonnan nyílik ki a naptárablak (Overlays) az adott termék előrendelésével. Csökkentett mozgásnál rögtön nyílik.
// products: [{ id, name, category, price, releaseDate, remaining, logo, href }]
const SPARKS = 14;
const LAUNCH_MS = 560;

export default function PreorderCards({ products }) {
  const [launch, setLaunch] = useState(null); // { id, x, y } – a kattintás helye a kártyán belül
  const passing = useRef(false);

  const onClick = (ev, p) => {
    if (passing.current || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; // az Overlays rögtön megnyitja
    ev.preventDefault(); // az Overlays a megelőzött kattintást nem nyitja meg: az animáció végén újraküldjük
    const a = ev.currentTarget;
    const r = a.getBoundingClientRect();
    const { clientX, clientY } = ev.clientX ? ev : { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    setLaunch({ id: p.id, x: clientX - r.left, y: clientY - r.top });
    setTimeout(() => {
      passing.current = true;
      a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX, clientY, button: 0 }));
      passing.current = false;
      setTimeout(() => setLaunch(null), 400);
    }, LAUNCH_MS);
  };

  return (
    <div className={s.preorders} data-elorendelesek data-count={products.length} data-reveal>
      {products.map(p => {
        const going = launch?.id === p.id;
        return (
          <a key={p.id} href={p.href} className={s.preorder} data-cal="" data-title={p.name} data-elorendeles
            data-indul={going ? '' : undefined} onClick={(ev) => onClick(ev, p)}>
            <span className={s.preorderTop}>
              <span className={s.live}><i data-elo aria-hidden="true" />Élő előrendelés</span>
              {p.remaining !== null && p.remaining <= 5
                ? <span className={s.preorderHot}>{p.remaining === 0 ? 'Elfogyott' : 'Utolsó darabok!'}</span>
                : p.remaining !== null && <span className={s.preorderLeft}>még {p.remaining} db</span>}
            </span>
            <span className={s.preorderMain}>
              {/* a játéklogók a naptár képei (public/jatekok), nem a weboldaléi */}
              <img className={s.preorderLogo} src={p.logo} alt="" width={56} height={56} loading="lazy" />
              <span className={s.preorderText}>
                <b>{p.name}</b>
                {p.releaseDate && <span>Megjelenés: {p.releaseDate}</span>}
              </span>
            </span>
            <span className={s.preorderBottom}>
              {p.price !== null && <b className={s.preorderPrice}>{formatPrice(p.price)}</b>}
              <span className={s.preorderGo}>Előrendelem ›</span>
            </span>
            {going && (
              <span className={s.burst} style={{ left: launch.x, top: launch.y }} aria-hidden="true">
                <i className={s.ring} />
                {Array.from({ length: SPARKS }, (_, i) => <i key={i} className={s.spark} data-szikra style={{ '--a': `${(360 / SPARKS) * i + (i % 2 ? 9 : 0)}deg`, '--d': `${70 + (i % 3) * 28}px` }} />)}
              </span>
            )}
          </a>
        );
      })}
    </div>
  );
}
