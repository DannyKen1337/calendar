"use client";
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import s from '@/weblap/fooldal.module.css';

// „Az összes album” gomb a főoldal Galéria részében (bal alsó sarok). Kattintásra a három fotó a gombba repül és
// összeáll egy paklivá, a gombból aranyszínű album-borító nyílik ki az egész képernyőre (fényvillanással), és
// utána nyílik a Galéria oldal, ahol a borító felhúzódik és az albumok egymás után beúsznak (AlbumList).
// Ctrl / Cmd / középső gomb: a megszokott módon, új lapon; csökkentett mozgásnál rögtön nyílik.
// href: a Galéria oldal; count: az albumok száma
export const ALBUM_INTRO_KEY = 'tavern-album-nyitas';
const FLY_MS = 1150;

export default function AlbumsLink({ href, count }) {
  const router = useRouter();
  const ref = useRef(null);
  const [cover, setCover] = useState(null); // a borító kiinduló helye: a gomb kerete (top, right, bottom, left)

  const onClick = (ev) => {
    if (cover || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    ev.preventDefault();
    const btn = ref.current.getBoundingClientRect();
    const cx = btn.left + btn.width / 2, cy = btn.top + btn.height / 2;
    const section = ref.current.closest('section');
    section.querySelectorAll('[data-nyomat]').forEach((el, i) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--dx', `${Math.round(cx - (r.left + r.width / 2))}px`);
      el.style.setProperty('--dy', `${Math.round(cy - (r.top + r.height / 2))}px`);
      el.style.setProperty('--i', String(i));
    });
    section.setAttribute('data-albumba', '');
    setCover({ t: btn.top, r: innerWidth - btn.right, b: innerHeight - btn.bottom, l: btn.left });
    try { sessionStorage.setItem(ALBUM_INTRO_KEY, String(Date.now())); } catch { /* nincs tárhely: a Galéria oldalon nincs belépő animáció */ }
    router.prefetch(href);
    setTimeout(() => router.push(href), FLY_MS);
  };

  return (
    <>
      <a ref={ref} href={href} className={s.albumsBtn} onClick={onClick} data-osszes-album>
        <span className={s.albumsStack} aria-hidden="true"><i /><i /><i /></span>
        <span className={s.albumsText}><b>Az összes album</b>{count > 0 && <small>{count} album a Galériában</small>}</span>
        <span className={s.albumsGo} aria-hidden="true"><svg viewBox="0 0 10 10"><path d="M1 5h7M5 2l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg></span>
      </a>
      {cover && (
        <div className={s.albumCover2} style={{ '--t': `${cover.t}px`, '--r': `${cover.r}px`, '--b': `${cover.b}px`, '--l': `${cover.l}px` }} aria-hidden="true" data-album-borito>
          <span className={s.albumCover2Flash} />
          <b>Galéria</b>
        </div>
      )}
    </>
  );
}
