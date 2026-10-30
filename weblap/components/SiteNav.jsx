"use client";
import { useEffect, useRef, useState } from 'react';
import Image from '@/weblap/components/Image';
import { withBase } from '@/weblap/lib/basePath';

// A fejléc: balra a cégér, jobbra fent egy gyorsgomb az oldal minden részéhez és a Naptár.
// A főoldalon kiemeli, melyik résznél jársz; az aloldalakon a főoldal részeire visz.
// Keskeny képernyőn a gyorsgombok egy "Menü" gomb mögé kerülnek (Escape vagy egy választás bezárja).
// s: a főoldal CSS-modulja; home: a főoldalon vagyunk-e; links: [{ id, label }]; extra: külső linkek [{ href, label }]
export default function SiteNav({ s, home = true, links, extra = [], cta }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null);
  const bar = useRef(null);

  useEffect(() => {
    if (!home) return undefined;
    const els = links.map(l => document.getElementById(l.id)).filter(Boolean);
    // Az a rész az aktív, amelyik a képernyő felső harmadán áthalad
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) setActive(en.target.id);
    }, { rootMargin: '-30% 0px -65% 0px' });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [home, links]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onClick = (e) => { if (!bar.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('click', onClick); };
  }, [open]);

  const base = home ? '' : withBase('/');
  return (
    <header ref={bar} className={`${s.nav} ${open ? s.navOpen : ''}`}>
      <a href={home ? '#' : withBase('/')} className={s.navBrand} aria-label={home ? 'Tavern – vissza az oldal tetejére' : 'Tavern – főoldal'}>
        <Image src="/brand/tavern-sign.png" alt="" width={1100} height={296} priority />
      </a>
      <button type="button" className={s.navMenu} aria-expanded={open} aria-controls="gyorsgombok" onClick={() => setOpen(o => !o)}>
        Menü
      </button>
      <nav id="gyorsgombok" className={s.navLinks} aria-label="Ugrás az oldal részeihez">
        {links.map(l => (
          <a key={l.id} href={`${base}#${l.id}`} aria-current={active === l.id ? 'location' : undefined} onClick={() => setOpen(false)}>{l.label}</a>
        ))}
        {extra.map(l => <a key={l.href} href={l.href}>{l.label}</a>)}
      </nav>
      <a href={cta.href} className={s.navCta}>{cta.label}</a>
    </header>
  );
}
