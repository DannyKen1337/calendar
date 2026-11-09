"use client";
import { useState } from 'react';
import s from '@/weblap/fooldal.module.css';

// A heti program boltonként, játékválasztóval. Az eseményeket a szerver adja a naptárból (a következő hét nap);
// egy eseményre kattintva a naptárablak (Overlays) nyitja meg a jelentkezési oldalát.
// stores: [{ id, name, street, logo }]; events: [{ id, store, name, game, category, logo, href, day, time, full }];
// games: [{ category, label }] a héten szereplő játékok; allLabel: a „Minden játék” felirat
export default function WeekProgram({ stores, events, games, allLabel }) {
  const [game, setGame] = useState('all');
  const shown = game === 'all' ? events : events.filter(e => e.category === game);
  return (
    <>
      {games.length > 1 && (
        <div className={s.picker} role="group" aria-label="Szűrés játék szerint">
          {[{ category: 'all', label: allLabel }, ...games].map(g => (
            <button key={g.category} type="button" aria-pressed={game === g.category} onClick={() => setGame(g.category)}>{g.label}</button>
          ))}
        </div>
      )}
      {stores.map(st => {
        const list = shown.filter(e => e.store === st.id);
        if (!list.length) return null;
        return (
          <div key={st.id} className={s.cat}>
            <div className={s.catHead}>
              <h3>{st.logo && <img src={st.logo} alt="" width={64} height={53} />}{st.name}</h3>
              <span>{st.street}</span>
            </div>
            <div className={s.items}>
              {list.map(e => (
                <a key={e.id} className={s.item} href={e.href} data-cal data-title={e.name}>
                  <img src={e.logo} alt={e.game} loading="lazy" width={96} height={56} />
                  <b>{e.name}</b>
                  <time dateTime={e.date}>{e.full && <span className={s.full}>betelt · </span>}{e.day} <em>{e.time}</em></time>
                </a>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
