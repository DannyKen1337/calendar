"use client";
import { useEffect, useRef, useState } from 'react';
import Image from '@/weblap/components/Image';
import s from '@/weblap/fooldal.module.css';

// A képfal (Élő mozaik): különböző méretű mezők, pár másodpercenként az egyikben körben kinyílik egy új kép.
// Gépen 5, telefonon 4 mező (kevesebb képnél annyi, ahány kép; ilyenkor nincs csere).
// Nem vált: szünet gombra, ha a fókusz benne van, ha nem látszik a képernyőn, rejtett lapon és csökkentett mozgásnál.
// pictures: [{ id, picture: { src, alt, position }, caption }]
const TILES = 5;
const EVERY = 2600;

export default function Mosaic({ title, pictures }) {
  const count = Math.min(TILES, pictures.length);
  // mezőnként: a látszó kép (cur), és ami épp kinyílik fölötte (next), a kör közepével
  const [tiles, setTiles] = useState(() => Array.from({ length: count }, (_, i) => ({ cur: i, next: null, x: 50, y: 50, k: 0 })));
  const [paused, setPaused] = useState(false);
  const [calm, setCalm] = useState(true); // csökkentett mozgás, rejtett lap, képernyőn kívül, fókusz: mind megállítja
  const root = useRef(null);
  const last = useRef(-1);
  const blocks = useRef({ reduced: false, hidden: false, offscreen: true, focus: false });

  useEffect(() => {
    const el = root.current;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => { const b = blocks.current; setCalm(b.reduced || b.hidden || b.offscreen || b.focus); };
    const set = (k, v) => { blocks.current[k] = v; sync(); };
    const onMedia = () => set('reduced', media.matches);
    const onVisibility = () => set('hidden', document.hidden);
    const onIn = () => set('focus', true);
    const onOut = (e) => { if (!el.contains(e.relatedTarget)) set('focus', false); };
    const io = new IntersectionObserver(([entry]) => set('offscreen', !entry.isIntersecting));
    onMedia(); onVisibility(); io.observe(el);
    media.addEventListener('change', onMedia);
    document.addEventListener('visibilitychange', onVisibility);
    el.addEventListener('focusin', onIn);
    el.addEventListener('focusout', onOut);
    return () => {
      io.disconnect();
      media.removeEventListener('change', onMedia);
      document.removeEventListener('visibilitychange', onVisibility);
      el.removeEventListener('focusin', onIn);
      el.removeEventListener('focusout', onOut);
    };
  }, []);

  const running = !paused && !calm && pictures.length > count;
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => {
      // csak a látszó mezők közül (telefonon az ötödik rejtve), nem ugyanaz kétszer egymás után
      const visible = [...root.current.querySelectorAll('[data-tile]')].map((el, i) => (el.offsetParent ? i : -1)).filter(i => i >= 0);
      setTiles(prev => {
        if (prev.some(t => t.next !== null)) return prev;
        const choices = visible.filter(i => i !== last.current);
        const t = choices[Math.floor(Math.random() * choices.length)];
        const used = new Set(prev.map(x => x.cur));
        const free = pictures.map((_, i) => i).filter(i => !used.has(i));
        if (t === undefined || !free.length) return prev;
        last.current = t;
        const next = free[Math.floor(Math.random() * free.length)];
        return prev.map((x, i) => (i === t ? { ...x, next, x: 20 + Math.round(Math.random() * 60), y: 20 + Math.round(Math.random() * 60), k: x.k + 1 } : x));
      });
    }, EVERY);
    return () => clearInterval(timer);
  }, [running, pictures]);

  const opened = (i) => setTiles(prev => prev.map((x, j) => (j === i && x.next !== null ? { ...x, cur: x.next, next: null } : x)));
  const img = (p, sizes) => (
    <Image src={p.picture.src} alt={p.picture.alt || p.caption || ''} fill sizes={sizes} style={{ objectPosition: p.picture.position }} />
  );

  return (
    <section ref={root} className={s.mosaic} aria-labelledby="kepfal-cim">
      <div className={s.mosaicHead}>
        <h2 id="kepfal-cim" className={s.disp} data-reveal>{title}</h2>
        {pictures.length > count && (
          <button type="button" className={s.mosaicPause} aria-label={paused ? 'Lejátszás' : 'Szünet'} onClick={() => setPaused(v => !v)}>
            {paused
              ? <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2l10 6-10 6z" /></svg>
              : <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2" width="3.5" height="12" /><rect x="9.5" y="2" width="3.5" height="12" /></svg>}
          </button>
        )}
      </div>
      <div className={s.mosaicGrid} data-count={count}>
        {tiles.map((t, i) => {
          const shown = pictures[t.next ?? t.cur] || pictures[0];
          const sizes = i === 0 ? '(max-width: 640px) 100vw, 50vw' : '(max-width: 640px) 50vw, 34vw';
          return (
            <figure key={i} className={s.mosaicTile} data-tile>
              {img(pictures[t.cur] || pictures[0], sizes)}
              {t.next !== null && (
                <div key={t.k} className={s.mosaicIn} style={{ '--x': `${t.x}%`, '--y': `${t.y}%` }} onAnimationEnd={(e) => { if (e.target === e.currentTarget) opened(i); }}>
                  {img(pictures[t.next], sizes)}
                </div>
              )}
              {shown.caption && <figcaption key={`c${t.k}`} className={`${s.mosaicCaption} ${s.disp}`}>{shown.caption}</figcaption>}
            </figure>
          );
        })}
      </div>
    </section>
  );
}
