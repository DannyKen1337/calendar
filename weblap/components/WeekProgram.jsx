"use client";
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import s from '@/weblap/fooldal.module.css';

// A heti program boltonként, játékválasztóval. Az eseményeket a szerver adja a naptárból (a következő hét nap);
// egy eseményre kattintva a naptárablak (Overlays) nyitja meg a jelentkezési oldalát.
// Mozgások (csökkentett mozgásnál nincsenek):
//  - szűréskor a kieső sorok elhalványulnak, a maradók az új helyükre csúsznak (FLIP), az újak beúsznak;
//  - a telítettség-sáv egyszer feltöltődik, amikor a bolt sorai a képernyőre érnek (JavaScript nélkül teli sáv látszik);
//  - a ma futó esemény „Most zajlik”, a 3 órán belül kezdődő „N perc múlva” jelzést kap lüktető ponttal (percenként frissül).
// stores: [{ id, name, street, logo }]; events: [{ id, store, name, game, category, logo, href, date, day, time, full, seats }];
// games: [{ category, label }] a héten szereplő játékok; allLabel: a „Minden játék” felirat
const RUNNING_MIN = 4 * 60; // ennyi ideig számít „most zajlik”-nak egy esemény a kezdése után
const SOON_MIN = 3 * 60;
const reduce = () => typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

// A budapesti idő percben, ugyanúgy, mint az esemény "YYYY-MM-DDTHH:MM" ideje (a különbség így időzónától független)
function budapestMinutes(date = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(x => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) / 60000;
}
const eventMinutes = (iso) => { const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 60000 : null; };
const inText = (min) => (min < 60 ? `${min} perc múlva` : `${Math.floor(min / 60)} óra${min % 60 ? ` ${min % 60} perc` : ''} múlva`);

export default function WeekProgram({ stores, events, games, allLabel }) {
  const [game, setGame] = useState('all');
  const [now, setNow] = useState(null); // csak a böngészőben (az élő jelzés nem kerül a szerveroldali HTML-be)
  const [animate, setAnimate] = useState(false); // a sávok a képernyőre érve töltődnek fel (JavaScript nélkül teli sáv)
  const [seen, setSeen] = useState(() => new Set()); // a boltok, amelyeknek a sorai már látszottak (a sávjuk teli)
  const items = useRef(new Map()); // esemény azonosító => sor
  const flip = useRef(null); // { first: Map(id => rect), prev: Set(id) } a szűrés utáni átrendezéshez
  const busy = useRef(false);
  const root = useRef(null);
  const shown = game === 'all' ? events : events.filter(e => e.category === game);

  useEffect(() => {
    const tick = () => setNow(budapestMinutes());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 60 * 1000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, []);

  // telítettség-sávok: boltonként, amikor a sorai a képernyőre érnek
  useEffect(() => {
    if (reduce()) return undefined;
    const start = setTimeout(() => setAnimate(true), 0);
    const io = new IntersectionObserver((entries) => entries.forEach(e => { if (e.isIntersecting) { const id = e.target.dataset.bolt; setSeen(prev => (prev.has(id) ? prev : new Set(prev).add(id))); io.unobserve(e.target); } }), { threshold: 0.25 });
    root.current?.querySelectorAll('[data-bolt]').forEach(el => io.observe(el));
    return () => { clearTimeout(start); io.disconnect(); };
  }, []);

  const pick = async (cat) => {
    if (cat === game || busy.current) return;
    if (reduce()) { setGame(cat); return; }
    busy.current = true;
    const next = new Set((cat === 'all' ? events : events.filter(e => e.category === cat)).map(e => e.id));
    const all = [...items.current.entries()];
    const leaving = all.filter(([id]) => !next.has(id)).map(([, el]) => el);
    await Promise.all(leaving.map(el => el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.97)' }], { duration: 140, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {})));
    flip.current = { first: new Map(all.filter(([id]) => next.has(id)).map(([id, el]) => [id, el.getBoundingClientRect()])), prev: new Set(all.map(([id]) => id)) };
    setGame(cat);
  };

  // a szűrés után: a maradó sorok a régi helyükről csúsznak a mostanira, az újak beúsznak
  useLayoutEffect(() => {
    const f = flip.current;
    if (!f) return;
    flip.current = null;
    let k = 0;
    for (const [id, el] of items.current) {
      const a = f.first.get(id);
      if (a) {
        const b = el.getBoundingClientRect();
        const dx = a.left - b.left, dy = a.top - b.top;
        if (dx || dy) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 300, easing: ease });
      } else if (!f.prev.has(id)) {
        el.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 260, delay: 120 + 35 * k++, easing: 'ease-out', fill: 'backwards' });
      }
    }
    setTimeout(() => { busy.current = false; }, 320);
  }, [game]);

  const live = (e) => {
    if (now === null) return null;
    const start = eventMinutes(e.date);
    if (start === null) return null;
    const diff = start - now;
    if (diff <= 0 && -diff < RUNNING_MIN) return { kind: 'run', text: 'Most zajlik' };
    if (diff > 0 && diff <= SOON_MIN) return { kind: 'soon', text: inText(diff) };
    return null;
  };

  return (
    <div ref={root} data-sav-anim={animate ? '' : undefined}>
      {games.length > 1 && (
        <div className={s.picker} role="group" aria-label="Szűrés játék szerint">
          {[{ category: 'all', label: allLabel }, ...games].map(g => (
            <button key={g.category} type="button" aria-pressed={game === g.category} onClick={() => pick(g.category)}>{g.label}</button>
          ))}
        </div>
      )}
      {stores.map(st => {
        const list = shown.filter(e => e.store === st.id);
        if (!list.length) return null;
        return (
          <div key={st.id} className={s.cat} data-bolt={st.id} data-latszik={seen.has(st.id) ? '' : undefined}>
            <div className={s.catHead}>
              <h3>{st.logo && <img src={st.logo} alt="" width={64} height={53} />}{st.name}</h3>
              <span>{st.street}</span>
            </div>
            <div className={s.items}>
              {list.map((e, i) => {
                const l = live(e);
                const ratio = e.seats ? e.seats.taken / e.seats.max : null;
                return (
                  <a key={e.id} ref={el => { if (el) items.current.set(e.id, el); else items.current.delete(e.id); }} className={s.item} href={e.href} data-cal data-title={e.name} data-esemeny={e.id}>
                    <img src={e.logo} alt={e.game} loading="lazy" width={96} height={56} />
                    <b>{e.name}</b>
                    <time dateTime={e.date}>
                      {l ? <span className={`${s.liveTag} ${l.kind === 'run' ? s.liveRun : ''}`} data-elo={l.kind}><i aria-hidden="true" />{l.text}</span> : <>{e.full && <span className={s.full}>betelt · </span>}{e.day} </>}
                      <em>{e.time}</em>
                    </time>
                    {ratio !== null && (
                      <span className={s.itemCap} role="img" aria-label={e.full ? 'Betelt' : `${e.seats.max - e.seats.taken} hely szabad`} data-telitettseg>
                        <i className={ratio >= 0.8 ? s.itemCapHot : ''} style={{ '--v': ratio.toFixed(3), '--k': i }} />
                      </span>
                    )}
                  </a>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
