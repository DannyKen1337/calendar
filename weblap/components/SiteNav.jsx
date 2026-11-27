"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Image from '@/weblap/components/Image';
import { withBase } from '@/weblap/lib/basePath';
import { DISCORD_URL } from '@/weblap/lib/links';
import s from '@/weblap/fooldal.module.css';

// A fejléc: jobbra fent egy gyorsgomb az oldal fő részeihez és a Naptár (a naptárablakot nyitja meg: data-cal).
// A főoldalon nincs cégér a fejlécben (ott a nyitókép maga a cégér), és kiemeli, melyik résznél jársz;
// az aloldalakon balra a cégér, és a gyorsgombok a főoldal részeire visznek.
// Annyi menüpont látszik, amennyi kifér (telefonon is); a többi a „Több” gomb lenyíló listájába kerül. Először a
// kevésbé fontosak kerülnek át (KEEP: minél nagyobb, annál tovább marad kint), a Galéria és a Hírek marad legtovább.
// links: [{ id, label }]; pages: külön oldalak [{ id, href, label, current }] (telefonon is látszanak);
// extra: külső linkek [{ href, label }]; cta: a kiemelt gomb { label, href }; logo: a cégér { src, alt }
// A Naptár gombtól jobbra a Tavern Discord-szervere: feltűnő, Discord-kék gomb a jellel (új lapon; telefonon kerek ikon).
// a Discord jele (Simple Icons, CC0)
const DISCORD_PATH = 'M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z';

const KEEP = { galeria: 6, hirek: 5, program: 4, boltok: 3, kapcsolat: 2 };

export default function SiteNav({ home = true, homeHref = withBase('/'), links, pages = [], extra = [], cta, logo }) {
  const [active, setActive] = useState(null);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [fitted, setFitted] = useState(false);
  const [open, setOpen] = useState(false);
  const headRef = useRef(null), boxRef = useRef(null), trackRef = useRef(null), moreRef = useRef(null);

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
  const items = [
    ...links.map(l => ({ key: l.id, href: `${base}#${l.id}`, label: l.label, current: active === l.id ? 'location' : undefined })),
    ...extra.map(l => ({ key: l.href, href: l.href, label: l.label })),
    ...pages.map(l => ({ key: l.id, href: l.href, label: l.label, current: l.current ? 'page' : undefined, page: true })),
  ];
  const prio = (it) => KEEP[it.key] ?? 1;
  // ebben a sorrendben kerülnek át a „Több” listába (a stabil rendezés megtartja az eredeti sorrendet)
  const hideOrder = [...items].sort((a, b) => prio(a) - prio(b)).map(it => it.key);
  const hidden = new Set(hideOrder.slice(0, hiddenCount));
  const shown = items.filter(it => !hidden.has(it.key));
  const moved = items.filter(it => hidden.has(it.key));

  // Kifér-e: ha a menüpontok sora szélesebb a helyénél, a következő kevésbé fontos pont átkerül (festés előtt)
  useLayoutEffect(() => {
    const box = boxRef.current, track = trackRef.current;
    if (!box || !track) return;
    if (track.offsetWidth > box.clientWidth + 0.5 && hiddenCount < items.length) setHiddenCount(c => c + 1);
    else if (!fitted) setFitted(true);
  });
  // Szélesség változásakor (forgatás, ablakméret) és a betűk betöltése után újramér
  const refit = useCallback(() => flushSync(() => setHiddenCount(0)), []);
  useEffect(() => {
    let w = headRef.current?.clientWidth;
    const ro = new ResizeObserver(([en]) => {
      const nw = en.contentRect.width;
      if (Math.abs(nw - w) < 1) return;
      w = nw; refit();
    });
    if (headRef.current) ro.observe(headRef.current);
    let alive = true;
    document.fonts?.ready.then(() => { if (alive) refit(); });
    return () => { alive = false; ro.disconnect(); };
  }, [refit]);

  // A lenyíló lista: kattintás mellé, Esc (a fókusz vissza a gombra), és ha már minden kifér, bezárul
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => { if (!headRef.current?.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === 'Escape') { setOpen(false); moreRef.current?.focus(); } };
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  useEffect(() => { if (!moved.length) setOpen(false); }, [moved.length]);

  const linkItems = shown.filter(it => !it.page), pageItems = shown.filter(it => it.page);
  return (
    <header className={s.nav} ref={headRef} data-fit={fitted ? '' : undefined}>
      {!home && (
        <a href={homeHref} className={s.navBrand} aria-label={`${logo.alt || 'Tavern'} – főoldal`}>
          <Image src={logo.src} alt="" width={1499} height={403} priority />
        </a>
      )}
      <div className={s.navFit} ref={boxRef}>
        <div className={s.navTrack} ref={trackRef}>
          {linkItems.length > 0 && (
            <nav className={s.navLinks} aria-label="Ugrás az oldal részeihez">
              {linkItems.map(it => <a key={it.key} href={it.href} aria-current={it.current} data-prio={prio(it)}>{it.label}</a>)}
            </nav>
          )}
          {pageItems.length > 0 && (
            <nav className={s.navPages} aria-label="Oldalak">
              {pageItems.map(it => <a key={it.key} href={it.href} aria-current={it.current} data-menu={it.key} data-prio={prio(it)}>{it.label}</a>)}
            </nav>
          )}
          {moved.length > 0 && (
            <button type="button" ref={moreRef} className={s.navMore} aria-expanded={open} aria-controls="fejlec-tobb" onClick={() => setOpen(o => !o)} data-tobb>
              <span>Több</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </button>
          )}
        </div>
      </div>
      {cta.label && cta.href && <a href={cta.href} className={s.navCta} {...(home ? { 'data-cal': '', 'data-title': cta.label } : {})}>{cta.label}</a>}
      <a href={DISCORD_URL} className={s.navDiscord} target="_blank" rel="noopener noreferrer" aria-label="Csatlakozz a Tavern Discord-szerveréhez (új lapon)" data-discord>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={DISCORD_PATH} /></svg>
        <span>Discord</span>
      </a>
      {moved.length > 0 && (
        <nav id="fejlec-tobb" className={s.navDrop} aria-label="További menüpontok" hidden={!open} data-tobb-lista>
          {moved.map(it => <a key={it.key} href={it.href} aria-current={it.current} onClick={() => setOpen(false)} {...(it.page ? { 'data-menu': it.key } : {})}>{it.label}</a>)}
        </nav>
      )}
    </header>
  );
}
