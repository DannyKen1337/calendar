"use client";
import { useEffect, useRef, useState } from 'react';
import { formatPrice } from '@/lib/preorders';
import s from '@/weblap/fooldal.module.css';

// Az Előrendelés sáv a főcím (cégér) alatt: finoman beúszik (CSS: .heroPre). Benne az élő (nyitott) előrendelések kis
// kártyái, lüktető „ÉLŐ” jelzéssel; kattintásra a kártya megnyomódik és felpattan, a kattintás helyéről aranyszikrák
// és egy körhullám indul, utána ugyanonnan nyílik ki a naptárablak (Overlays) az adott termékkel. Csökkentett mozgásnál
// rögtön nyílik. Ha nincs nyitott előrendelés, egyetlen „Előrendelés” link látszik.
// Ha van megadott készlet, egy sáv mutatja, mennyi maradt: a sáv beúszása után a valós értékre fogy, az „Utolsó darabok!”
// címke egyszer megrázkódik (csökkentett mozgásnál egyik sincs; JavaScript nélkül a valós érték látszik).
// products: [{ id, name, category, price, releaseDate, remaining, stock, logo, href }]; allHref: az összes előrendelés
const SPARKS = 14;
const LAUNCH_MS = 560;

export default function PreorderCards({ products, allHref }) {
  const [launch, setLaunch] = useState(null); // { id, x, y } – a kattintás helye a kártyán belül
  const passing = useRef(false);
  const box = useRef(null);

  // a sáv beúszása után (a töltőképernyővel később): a készletsávok fogynak, az „Utolsó darabok!” megrázkódik
  useEffect(() => {
    const el = box.current;
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    el.dataset.keszletAnim = '';
    const wait = document.documentElement.dataset.tolto === 'fut' ? 3000 : 1600;
    const t = setTimeout(() => { el.dataset.keszletFut = ''; }, wait);
    return () => clearTimeout(t);
  }, []);

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

  if (!products.length) {
    return (
      <div className={s.heroPre} data-elorendeles-sav data-count="0">
        <a className={s.preorderSolo} href={allHref} data-cal="" data-title="Előrendelés">
          <span className={s.live}>Előrendelés</span>
          <span>Foglald le az új kiadást a megjelenés előtt</span>
          <span className={s.preorderGo} aria-hidden="true">›</span>
        </a>
      </div>
    );
  }

  return (
    <div ref={box} className={s.heroPre} data-elorendeles-sav data-count={products.length}>
      <div className={s.heroPreHead}>
        <span className={s.live}><i data-elo aria-hidden="true" />Élő előrendelés</span>
        <a className={s.preorderAll} href={allHref} data-cal="" data-title="Előrendelés" data-osszes-elorendeles aria-haspopup="dialog">Összes előrendelés<span aria-hidden="true">›</span></a>
      </div>
      <div className={s.preorders} data-elorendelesek data-count={products.length}>
        {products.map(p => {
          const going = launch?.id === p.id;
          return (
            <a key={p.id} href={p.href} className={s.preorder} data-cal="" data-title={p.name} data-elorendeles
              data-indul={going ? '' : undefined} onClick={(ev) => onClick(ev, p)}>
              {/* a játéklogók a naptár képei (public/jatekok), nem a weboldaléi */}
              <img className={s.preorderLogo} src={p.logo} alt="" width={44} height={44} />
              <span className={s.preorderText}>
                <b>{p.name}</b>
                <span>
                  {[p.releaseDate && `Megjelenés: ${p.releaseDate}`, p.price !== null && formatPrice(p.price)].filter(Boolean).join(' · ')}
                  {p.remaining !== null && p.remaining <= 5 && <em className={s.preorderHot} data-utolso>{p.remaining === 0 ? 'Elfogyott' : 'Utolsó darabok!'}</em>}
                </span>
                {p.stock > 0 && p.remaining !== null && (
                  <span className={s.preorderStock} role="img" aria-label={`Még ${p.remaining} darab a ${p.stock}-ból`} data-keszlet>
                    <i className={p.remaining / p.stock <= 0.2 ? s.preorderStockLow : ''} style={{ '--v': Math.max(0, Math.min(1, p.remaining / p.stock)).toFixed(3) }} />
                  </span>
                )}
              </span>
              <span className={s.preorderGo} aria-hidden="true">›</span>
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
    </div>
  );
}
