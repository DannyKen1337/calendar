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

    // A Galéria fotói egérrel fölé menve enyhén megbillennek, és fény fut rajtuk (mint egy kártya a kézben); érintésnél nincs
    const prints = [...document.querySelectorAll('[data-nyomat]')];
    const tilt = (e) => {
      if (e.pointerType !== 'mouse') return;
      const el = e.currentTarget, r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      el.dataset.billen = '';
      el.style.setProperty('--ry', `${(x * 14).toFixed(2)}deg`);
      el.style.setProperty('--rx', `${(-y * 14).toFixed(2)}deg`);
      el.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(1)}%`);
      el.style.setProperty('--gy', `${((y + 0.5) * 100).toFixed(1)}%`);
      el.style.setProperty('--go', '1');
    };
    const untilt = (e) => { const el = e.currentTarget; delete el.dataset.billen; ['--rx', '--ry', '--go'].forEach(p => el.style.removeProperty(p)); };
    prints.forEach(el => { el.addEventListener('pointermove', tilt); el.addEventListener('pointerleave', untilt); });

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
      prints.forEach(el => { el.removeEventListener('pointermove', tilt); el.removeEventListener('pointerleave', untilt); });
    };
  }, []);
  return null;
}
