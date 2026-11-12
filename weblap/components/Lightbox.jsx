"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import s from '@/weblap/fooldal.module.css';

// Egy album képei rácsban; kattintásra nagyban (teljes képernyő): nyilak, Esc, billentyűzet és ujjal lapozás,
// a szomszéd képek előre betöltődnek. pictures: [{ id, src, thumb, alt, caption }]; title: az album neve (a képleíráshoz)
export default function AlbumPhotos({ pictures, title }) {
  const [open, setOpen] = useState(null); // a megnyitott kép sorszáma
  const lastFocus = useRef(null);
  const closeRef = useRef(null);
  const touch = useRef(null);
  const n = pictures.length;
  const go = useCallback((d) => setOpen(i => (i === null ? i : (i + d + n) % n)), [n]);
  const close = useCallback(() => { setOpen(null); lastFocus.current?.focus?.(); }, []);

  useEffect(() => {
    if (open === null) return undefined;
    document.documentElement.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    addEventListener('keydown', onKey);
    return () => { removeEventListener('keydown', onKey); document.documentElement.style.overflow = ''; };
  }, [open, go, close]);
  useEffect(() => { if (open !== null) closeRef.current?.focus(); }, [open === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const alt = (p, i) => p.alt || p.caption || `${title} – ${i + 1}. kép`;
  const cur = open !== null ? pictures[open] : null;
  return (
    <>
      <ul className={s.albumPhotos}>
        {pictures.map((p, i) => (
          <li key={p.id || i}>
            <button type="button" data-kep onClick={(e) => { lastFocus.current = e.currentTarget; setOpen(i); }} aria-label={`${alt(p, i)} – nagyítás`}>
              {/* Külső képek (ImgBB): sima img, a rácsban a kisebb változat */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumb || p.src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
            </button>
            {p.caption && <span className={s.albumCaption}>{p.caption}</span>}
          </li>
        ))}
      </ul>
      {cur && (
        <div className={s.lightbox} role="dialog" aria-modal="true" aria-label={`${title}: ${open + 1}. kép a(z) ${n} közül`} data-nagyito
          onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - (touch.current ?? 0); if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); touch.current = null; }}>
          <div className={s.lightboxBar}>
            <span>{open + 1} / {n}</span>
            <button ref={closeRef} type="button" className={s.close} aria-label="Bezárás" onClick={close}>
              <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.6" /></svg>
            </button>
          </div>
          <figure className={s.lightboxFig} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={cur.src} src={cur.src} alt={alt(cur, open)} referrerPolicy="no-referrer" />
            {cur.caption && <figcaption>{cur.caption}</figcaption>}
          </figure>
          {n > 1 && (
            <>
              <button type="button" className={`${s.lightboxNav} ${s.lightboxPrev}`} aria-label="Előző kép" onClick={() => go(-1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg></button>
              <button type="button" className={`${s.lightboxNav} ${s.lightboxNext}`} aria-label="Következő kép" onClick={() => go(1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg></button>
              {/* a szomszéd képek előre betöltve */}
              <span hidden>{[...new Set([(open + n - 1) % n, (open + 1) % n])].filter(i => i !== open).map(i => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={pictures[i].src} alt="" referrerPolicy="no-referrer" />
              ))}</span>
            </>
          )}
        </div>
      )}
    </>
  );
}
