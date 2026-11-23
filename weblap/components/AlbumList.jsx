"use client";
import { useEffect, useState, ViewTransition } from 'react';
import Link from 'next/link';
import { ALBUM_INTRO_KEY } from '@/weblap/components/AlbumsLink';
import s from '@/weblap/fooldal.module.css';

// A Galéria oldal albumkártyái, játékszűrővel (ha több játék albumai is vannak). Ha a főoldal „Az összes album”
// gombjával érkezett (AlbumsLink, néhány másodpercen belül), az arany borító felhúzódik, és a kártyák egymás után
// beúsznak, mintha a pakliból terülnének szét. Egy albumra kattintva a borítója átnő a megnyitott album fejlécképébe
// (React ViewTransition, azonos név a két oldalon; csak a támogató böngészőkben, csökkentett mozgásnál nincs).
// albums: [{ id, href, title, date, store, game, gameLabel, count, cover }]
const fromHomeButton = () => {
  try { const t = Number(sessionStorage.getItem(ALBUM_INTRO_KEY)); return t > 0 && Date.now() - t < 5000; } catch { return false; }
};

export default function AlbumList({ albums }) {
  const games = [...new Map(albums.filter(a => a.game).map(a => [a.game, a.gameLabel])).entries()];
  const [game, setGame] = useState('all');
  // Csak kliensoldali átlépésnél igaz (a gomb után): ilyenkor nincs szerveroldali HTML, amivel ütközne
  const [intro, setIntro] = useState(fromHomeButton);
  useEffect(() => { if (intro) try { sessionStorage.removeItem(ALBUM_INTRO_KEY); } catch { /* nincs tárhely */ } }, [intro]);
  const shown = game === 'all' ? albums : albums.filter(a => a.game === game);
  return (
    <>
      {intro && <div className={s.albumCurtain} aria-hidden="true" onAnimationEnd={(e) => { if (e.target === e.currentTarget) setIntro(false); }} data-album-fuggony><b>Galéria</b></div>}
      {games.length > 1 && (
        <div className={s.picker} role="group" aria-label="Szűrés játék szerint">
          {[['all', 'Mind'], ...games].map(([id, label]) => (
            <button key={id} type="button" aria-pressed={game === id} onClick={() => setGame(id)}>{label}</button>
          ))}
        </div>
      )}
      <ul className={s.albums} data-belep={intro ? '' : undefined}>
        {shown.map((a, i) => (
          <li key={a.id} style={{ '--i': i }}>
            <Link href={a.href} className={s.albumCard} data-album>
              <ViewTransition name={`album-${a.id}`} share="morph" default="none">
              <span className={s.albumCover}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.cover} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                <span className={s.albumCount}>{a.count} kép</span>
              </span>
              </ViewTransition>
              <span className={s.albumMeta}>{[a.date, a.store].filter(Boolean).join(' · ')}</span>
              <b className={s.albumTitle}>{a.title}</b>
              {a.gameLabel && <span className={s.albumGame}>{a.gameLabel}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
