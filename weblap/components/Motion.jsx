"use client";
import { useEffect } from 'react';
import s from '@/weblap/fooldal.module.css';

// A főoldal mozgása:
//  - a [data-reveal] elemek beúsznak, amikor a képernyőre érnek. Csak a betöltéskor képernyőn kívüli elemeket rejti el,
//    így nincs villanás, és JavaScript nélkül minden látszik.
//  - a cégér ([data-sign]) görgetésre felfelé kiúszik, összemegy és elhalványul (a --p 0-tól 1-ig nő).
// Csökkentett mozgásnál egyik sem fut.
export default function Motion() {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    // Görgetéskor (és átméretezéskor) közvetlenül megnézi, mely elrejtett elemek értek a képernyőre. Ez nem függ
    // megfigyelőtől, így a naptár- és térképablak (a görgetés zárolása, a vissza gomb) sem akaszthatja meg.
    let pending = [...document.querySelectorAll('[data-reveal]')].filter(el => el.getBoundingClientRect().top > innerHeight);
    pending.forEach(el => { el.classList.remove(s.shown); el.classList.add(s.pending); });
    let revealFrame = 0;
    const reveal = () => {
      cancelAnimationFrame(revealFrame);
      revealFrame = requestAnimationFrame(() => {
        const limit = innerHeight * 0.92;
        pending = pending.filter(el => {
          if (el.getBoundingClientRect().top > limit) return true;
          el.classList.add(s.shown);
          el.classList.remove(s.pending);
          return false;
        });
      });
    };
    addEventListener('scroll', reveal, { passive: true });
    addEventListener('resize', reveal);

    const sign = document.querySelector('[data-sign]');
    const hero = sign?.closest('section');
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const p = Math.min(1, Math.max(0, scrollY / ((hero?.offsetHeight || innerHeight) * 0.85)));
        sign?.style.setProperty('--p', p.toFixed(3));
      });
    };
    if (sign) { addEventListener('scroll', onScroll, { passive: true }); onScroll(); }
    return () => {
      removeEventListener('scroll', reveal); removeEventListener('resize', reveal); cancelAnimationFrame(revealFrame);
      // Ha a komponens újraindul, ne maradjon elrejtve semmi
      pending.forEach(el => { el.classList.remove(s.pending); el.classList.add(s.shown); });
      removeEventListener('scroll', onScroll); cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
