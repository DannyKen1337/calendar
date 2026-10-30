"use client";
import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP, ScrollTrigger);

// A főoldal mozgása (GSAP). Minden csak akkor mozog, ha a látogató nem kért csökkentett mozgást;
// JavaScript nélkül és csökkentett mozgásnál a kész oldal látszik. A nyitóképernyő részeit a layout
// inline szkriptje rejti el (html.motion) az első kirajzolás előtt, ez a komponens hozza be őket.
//
// - Nyitás (1,2 mp alatt kész): a festmény kivilágosodik, a cégér-kártya felemelkedik, a cégér felülről beúszik, a szavak sorban kiemelkednek.
// - Görgetésre a cégér-kártya felfelé kiúszik és kicsit összemegy, a festmény lassan elmozdul (a görgetéshez kötve).
// - Étlap: a lap felemelkedik, a sorai egymás után érkeznek, mellette a fotó kinyílik.
// - Program: a napfülek és a sávok sorban érkeznek. Boltok: a fotó lassan úszik a kártya mögött, a kártya felemelkedik.
// - Hírek: a csempék sorban, a képük kinyílik. Lábléc: a lap felemelkedik, a bélyeg rácsapódik.
const EXPO = 'expo.out';
const QUINT = 'power4.out';

export default function HomeMotion({ className, children }) {
  const root = useRef(null);

  useGSAP(() => {
    window.__tavernMotion = true;
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const q = gsap.utils.selector(root);

      // Nyitás
      const intro = gsap.timeline({ defaults: { ease: EXPO } });
      intro
        .fromTo(q('[data-hero-bg]'), { autoAlpha: 0, scale: 1.12 }, { autoAlpha: 1, scale: 1, duration: 1.2, ease: 'power2.out' }, 0)
        .fromTo(q('[data-hero-card]'), { autoAlpha: 0, y: 60, scale: 0.94 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.9 }, 0.1)
        .fromTo(q('[data-hero-sign]'), { yPercent: -40, clipPath: 'inset(0 0 100% 0)' }, { yPercent: 0, clipPath: 'inset(0 0 0% 0)', duration: 0.9, ease: 'power3.inOut' }, 0.2)
        .fromTo(q('[data-hero-word]'), { yPercent: 105 }, { yPercent: 0, duration: 0.7, stagger: 0.09 }, 0.35)
        .fromTo(q('[data-hero-rise]'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: QUINT, stagger: 0.07 }, 0.5);

      // Görgetésre a cégér kiúszik
      const hero = q('[data-hero]')[0];
      if (hero) {
        gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } })
          .to(q('[data-hero-card]'), { yPercent: -28, scale: 0.94, ease: 'none' }, 0)
          .to(q('[data-hero-bg]'), { yPercent: 7, ease: 'none' }, 0);
      }

      // Egyszeri belépők: a szakasz részei olvasási sorrendben
      const once = (trigger, build) => {
        const tl = gsap.timeline({ paused: true });
        build(tl);
        ScrollTrigger.create({ trigger, start: 'top 88%', once: true, onEnter: () => tl.play() });
      };
      const shutter = (tl, el, at = 0) => {
        if (!el) return;
        tl.fromTo(el, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 1.1, ease: 'power3.inOut' }, at);
        const img = el.querySelector('img');
        if (img) tl.fromTo(img, { scale: 1.12 }, { scale: 1, duration: 1.4, ease: 'power2.out' }, at);
      };

      q('[data-heading]').forEach(h => once(h, tl => tl.fromTo(h, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: EXPO })));

      // Étlap: a lap felemelkedik, a sorai egymás után érkeznek, a fotó kinyílik
      q('[data-menu]').forEach(m => once(m, tl => {
        tl.fromTo(m.querySelector('[data-menu-sheet]'), { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: EXPO }, 0)
          .fromTo(m.querySelectorAll('[data-menu-row]'), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: QUINT, stagger: 0.07 }, 0.25);
        shutter(tl, m.querySelector('[data-menu-picture]'), 0.1);
      }));

      // Program
      q('[data-agenda]').forEach(a => once(a, tl => {
        tl.fromTo(a.querySelectorAll('[role="tab"]'), { autoAlpha: 0, x: -16 }, { autoAlpha: 1, x: 0, duration: 0.6, ease: QUINT, stagger: 0.05 }, 0)
          .fromTo(a.querySelectorAll('[data-band]'), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: QUINT, stagger: 0.06 }, 0.15);
      }));

      // Boltok
      q('[data-visit]').forEach(v => {
        const img = v.querySelector('[data-visit-picture] img');
        if (img) gsap.fromTo(img, { yPercent: -4 }, { yPercent: 4, ease: 'none', scrollTrigger: { trigger: v, start: 'top bottom', end: 'bottom top', scrub: true } });
        const card = v.querySelector('[data-visit-card]');
        once(v, tl => tl.fromTo(card, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: EXPO }, 0.1)
          .fromTo(card.querySelectorAll('[data-visit-rise]'), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: QUINT, stagger: 0.06 }, 0.3));
      });

      // Hírek
      q('[data-tiles]').forEach(g => once(g, tl => {
        g.querySelectorAll('[data-tile]').forEach((t, i) => {
          tl.fromTo(t, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: EXPO }, i * 0.07);
          shutter(tl, t.querySelector('[data-tile-picture]'), i * 0.07);
        });
      }));

      // Lábléc
      q('[data-back]').forEach(b => once(b, tl => {
        tl.fromTo(b, { y: 60 }, { y: 0, duration: 1, ease: EXPO }, 0)
          .fromTo(b.querySelector('[data-stamp]'), { autoAlpha: 0, scale: 1.4, rotate: -14 }, { autoAlpha: 1, scale: 1, rotate: -4, duration: 0.6, ease: QUINT }, 0.35);
      }));
    });
    // Csökkentett mozgásnál (vagy ha a fenti nem fut) se maradjon rejtve a nyitóképernyő
    document.documentElement.classList.remove('motion-wait');

    // Ha az oldal magassága változik (a program hidratálás után csak egy napot mutat, napváltás, betöltődő képek),
    // a görgetési pontokat újra kell mérni, különben a lejjebb lévő belépők rossz helyen indulnak
    let t;
    const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => ScrollTrigger.refresh(), 120); });
    ro.observe(root.current);
    return () => { clearTimeout(t); ro.disconnect(); mm.revert(); };
  }, { scope: root });

  return <div ref={root} className={className}>{children}</div>;
}
