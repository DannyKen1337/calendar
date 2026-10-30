"use client";
import { useRef, useState, useSyncExternalStore } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { numericDay, timeOf, DAY_NAMES, ON_DAY, eventUrl, gameShort, gameImage, spotsText } from '@/weblap/lib/calendar';
import { nextOpening } from '@/weblap/lib/stores';
import { withBase } from '@/weblap/lib/basePath';

gsap.registerPlugin(useGSAP);

// A hét programja napfülekkel: balra a napok egymás alatt (telefonon egy sorban), jobbra a kiválasztott nap
// boltonként (széles képernyőn három oszlopban): elöl a bolt neve és nyitvatartása, alatta az eseményei sávokban.
// Ha egy bolt aznap zárva van, azt írjuk ki (és hogy mikor nyit legközelebb).
// JavaScript nélkül minden nap látszik egymás alatt (a fülek csak szűrnek).
// week: weekByStore() eredménye; stores: [{ id, name, hours }]; s: a főoldal CSS-modulja; gameImages: a játékok képei (Program fül).
const noop = () => () => {};
const SHORT = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'];

export default function DayProgram({ week, stores, s, gameImages }) {
  const root = useRef(null);
  const firstBusy = Math.max(0, week.findIndex(d => stores.some(st => d.events[st.id].length)));
  const [sel, setSel] = useState(firstBusy);
  const changed = useRef(false);
  const isClosed = (st, wd) => !!st.hours && st.hours[wd] === null;
  // Csak a böngészőben (hidratálás után) rejtjük el a nem kiválasztott napokat
  const live = useSyncExternalStore(noop, () => true, () => false);

  // Napváltáskor a sávok sorban érkeznek (az első megjelenést a HomeMotion intézi)
  useGSAP(() => {
    if (!changed.current) return;
    gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(`#nap-${week[sel].day} [data-band]`, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power4.out', stagger: 0.05 });
    });
  }, { dependencies: [sel], scope: root, revertOnUpdate: true });

  const choose = (i) => { changed.current = true; setSel(i); };
  // Billentyűzet: a fülsor egyetlen Tab-megálló, benne nyilakkal, Home/End-del lehet lépkedni
  const onKeyDown = (e) => {
    const next = { ArrowRight: sel + 1, ArrowDown: sel + 1, ArrowLeft: sel - 1, ArrowUp: sel - 1, Home: 0, End: week.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const i = (next + week.length) % week.length;
    choose(i);
    e.currentTarget.querySelectorAll('[role="tab"]')[i]?.focus();
  };

  return (
    <div ref={root} className={`${s.agenda} ${live ? s.agendaLive : ''}`} data-agenda>
      <div className={s.dayTabs} role="tablist" aria-label="Nap kiválasztása" aria-orientation="vertical" onKeyDown={onKeyDown}>
        {week.map((d, i) => {
          const count = stores.reduce((n, st) => n + d.events[st.id].length, 0);
          return (
            <button key={d.day} id={`nap-${d.day}-ful`} type="button" role="tab" aria-selected={sel === i} aria-controls={`nap-${d.day}`}
              tabIndex={sel === i ? 0 : -1} className={`${s.dayTab} ${sel === i ? s.dayTabOn : ''}`} onClick={() => choose(i)}>
              <b><span className={s.dayLong}>{DAY_NAMES[d.wd]}</span><span className={s.dayShort} aria-hidden="true">{SHORT[d.wd]}</span></b>
              <span><span className={s.dayLong}>{numericDay(d.day)}</span><span className={s.dayShort}>{d.day.slice(8).replace(/^0/, '')}.</span><span className={s.dayCount}> · {count ? `${count} esemény` : 'nincs esemény'}</span></span>
            </button>
          );
        })}
      </div>
      {week.map((d, i) => {
        return (
          <div key={d.day} id={`nap-${d.day}`} role="tabpanel" aria-labelledby={`nap-${d.day}-ful`}
            className={`${s.dayPanel} ${sel === i ? s.dayPanelOn : ''}`}>
            <h3 className={s.dayTitle}>{DAY_NAMES[d.wd]}, {numericDay(d.day)}</h3>
            {/* Boltonként: elöl a bolt neve és aznapi nyitvatartása, alatta az eseményei időrendben */}
            <div className={s.dayStores}>
              {stores.map(st => {
                const list = d.events[st.id];
                const hours = st.hours ? st.hours[d.wd] : undefined;
                const closed = isClosed(st, d.wd);
                const reopen = closed ? nextOpening(st, d.wd) : null;
                return (
                  <section key={st.id} className={`${s.dayStore} ${closed && !list.length ? s.dayStoreClosed : ''}`} aria-labelledby={`nap-${d.day}-${st.id}`}>
                    <h4 id={`nap-${d.day}-${st.id}`} className={s.dayStoreName}>{st.name}</h4>
                    <p className={s.dayStoreHours}>{hours ? `Nyitva ${hours[0]}–${hours[1]}` : closed ? 'Zárva' : st.city}</p>
                    {list.length ? (
                      <ul className={s.bands}>
                        {list.map(e => (
                          <li key={e._id} className={s.band} data-band>
                            <span className={s.bandTime}>{timeOf(e.date)}</span>
                            <span className={s.bandWhat}>
                              <a href={eventUrl(e)} className={s.bandTitle}>{e.name}</a>
                              <span className={s.bandNote}>{gameShort(e.category)} · {spotsText(e)}</span>
                            </span>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img className={s.bandGame} src={withBase(gameImage(e.category, gameImages))} alt="" width="36" height="36" loading="lazy" />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className={s.dayStoreNote} data-band>
                        {closed
                          ? `${ON_DAY[d.wd][0].toUpperCase() + ON_DAY[d.wd].slice(1)} zárva vagyunk.${reopen ? ` Legközelebb ${reopen} nyitunk.` : ''}`
                          : 'Nincs meghirdetett esemény. Gyere játszani, van szabad asztal.'}
                      </p>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
