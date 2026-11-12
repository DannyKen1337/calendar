"use client";
import { useState } from 'react';
import s from '@/weblap/fooldal.module.css';

// A Galéria oldal albumkártyái, játékszűrővel (ha több játék albumai is vannak).
// albums: [{ id, href, title, date, store, game, gameLabel, count, cover }]
export default function AlbumList({ albums }) {
  const games = [...new Map(albums.filter(a => a.game).map(a => [a.game, a.gameLabel])).entries()];
  const [game, setGame] = useState('all');
  const shown = game === 'all' ? albums : albums.filter(a => a.game === game);
  return (
    <>
      {games.length > 1 && (
        <div className={s.picker} role="group" aria-label="Szűrés játék szerint">
          {[['all', 'Mind'], ...games].map(([id, label]) => (
            <button key={id} type="button" aria-pressed={game === id} onClick={() => setGame(id)}>{label}</button>
          ))}
        </div>
      )}
      <ul className={s.albums}>
        {shown.map(a => (
          <li key={a.id}>
            <a href={a.href} className={s.albumCard} data-album>
              <span className={s.albumCover}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.cover} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                <span className={s.albumCount}>{a.count} kép</span>
              </span>
              <span className={s.albumMeta}>{[a.date, a.store].filter(Boolean).join(' · ')}</span>
              <b className={s.albumTitle}>{a.title}</b>
              {a.gameLabel && <span className={s.albumGame}>{a.gameLabel}</span>}
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
