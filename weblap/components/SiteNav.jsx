"use client";
import { useEffect, useState } from 'react';
import Image from '@/weblap/components/Image';
import { withBase } from '@/weblap/lib/basePath';
import s from '@/weblap/fooldal.module.css';

// A fejléc: jobbra fent egy gyorsgomb az oldal fő részeihez és a Naptár (a naptárablakot nyitja meg: data-cal).
// A főoldalon nincs cégér a fejlécben (ott a nyitókép maga a cégér), és kiemeli, melyik résznél jársz;
// az aloldalakon balra a cégér, és a gyorsgombok a főoldal részeire visznek. Keskeny képernyőn csak a Naptár marad.
// links: [{ id, label }]; extra: külső linkek [{ href, label }]; cta: a kiemelt gomb { label, href }; logo: a cégér { src, alt }
export default function SiteNav({ home = true, links, extra = [], cta, logo }) {
  const [active, setActive] = useState(null);

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

  const base = home ? '' : withBase('/');
  return (
    <header className={s.nav}>
      {!home && (
        <a href={withBase('/')} className={s.navBrand} aria-label={`${logo.alt || 'Tavern'} – főoldal`}>
          <Image src={logo.src} alt="" width={1096} height={286} priority />
        </a>
      )}
      <nav className={s.navLinks} aria-label="Ugrás az oldal részeihez">
        {links.map(l => (
          <a key={l.id} href={`${base}#${l.id}`} aria-current={active === l.id ? 'location' : undefined}>{l.label}</a>
        ))}
        {extra.map(l => <a key={l.href} href={l.href}>{l.label}</a>)}
      </nav>
      {cta.label && cta.href && <a href={cta.href} className={s.navCta} {...(home ? { 'data-cal': '', 'data-title': cta.label } : {})}>{cta.label}</a>}
    </header>
  );
}
