"use client";
import { useEffect, useState } from 'react';
import Image from '@/weblap/components/Image';
import { withBase } from '@/weblap/lib/basePath';
import { DISCORD_URL } from '@/weblap/lib/links';
import s from '@/weblap/fooldal.module.css';

// A fejléc: jobbra fent egy gyorsgomb az oldal fő részeihez és a Naptár (a naptárablakot nyitja meg: data-cal).
// A főoldalon nincs cégér a fejlécben (ott a nyitókép maga a cégér), és kiemeli, melyik résznél jársz;
// az aloldalakon balra a cégér, és a gyorsgombok a főoldal részeire visznek. Keskeny képernyőn csak a Naptár marad.
// links: [{ id, label }]; pages: külön oldalak [{ id, href, label, current }] (telefonon is látszanak);
// extra: külső linkek [{ href, label }]; cta: a kiemelt gomb { label, href }; logo: a cégér { src, alt }
// A Naptár gombtól jobbra a Tavern Discord-szervere: feltűnő, Discord-kék gomb a jellel (új lapon; telefonon kerek ikon).
// a Discord jele (Simple Icons, CC0)
const DISCORD_PATH = 'M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z';

export default function SiteNav({ home = true, homeHref = withBase('/'), links, pages = [], extra = [], cta, logo }) {
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

  const base = home ? '' : homeHref;
  return (
    <header className={s.nav}>
      {!home && (
        <a href={homeHref} className={s.navBrand} aria-label={`${logo.alt || 'Tavern'} – főoldal`}>
          <Image src={logo.src} alt="" width={1499} height={403} priority />
        </a>
      )}
      <nav className={s.navLinks} aria-label="Ugrás az oldal részeihez">
        {links.map(l => (
          <a key={l.id} href={`${base}#${l.id}`} aria-current={active === l.id ? 'location' : undefined}>{l.label}</a>
        ))}
        {extra.map(l => <a key={l.href} href={l.href}>{l.label}</a>)}
      </nav>
      {pages.length > 0 && (
        <nav className={s.navPages} aria-label="Oldalak">
          {pages.map(l => <a key={l.id} href={l.href} aria-current={l.current ? 'page' : undefined} data-menu={l.id}>{l.label}</a>)}
        </nav>
      )}
      {cta.label && cta.href && <a href={cta.href} className={s.navCta} {...(home ? { 'data-cal': '', 'data-title': cta.label } : {})}>{cta.label}</a>}
      <a href={DISCORD_URL} className={s.navDiscord} target="_blank" rel="noopener noreferrer" aria-label="Csatlakozz a Tavern Discord-szerveréhez (új lapon)" data-discord>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={DISCORD_PATH} /></svg>
        <span>Discord</span>
      </a>
    </header>
  );
}
