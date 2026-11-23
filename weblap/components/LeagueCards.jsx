"use client";
import { useEffect, useRef } from 'react';
import { getGameConfig, DEFAULT_GAME_LOGO } from '@/lib/gameConfig';
import { leagueUrl } from '@/lib/leagues';
import s from '@/weblap/fooldal.module.css';

// A Ligák mező ranglistái: liganként egy kártya (játéklogó, liga neve, boltjai, az élmezőny, link a teljes ranglistára).
// Egy játéknak boltonként több ligája is lehet. A még eredmény nélküli (publikált) liga „Hamarosan indul” kártyát kap.
// 2–4 ligára készült: 2 ligánál két, 3-nál három oszlop, 4-nél széles képernyőn négy, közepesen 2×2; telefonon egymás
// alatt, liganként az első három. A teljes ranglista a naptár /liga oldalán, az oldalon belüli naptárablakban nyílik.
// leagues: a publikált ligák (lib/leagueData.js: getPublishedLeagues), legfeljebb 6
// Mozgás: amikor a kártyák a képernyőre érnek, a sorok egymás után beúsznak, a pontok felpörögnek a végső értékre, és a
// publikálás óta előrelépők ▲ jele ugrik egyet (egyszer; csökkentett mozgásnál nincs). JavaScript nélkül a végső állás látszik.
const TOP = 5;
const MEDALS = ['#e5b15d', '#c9ccd1', '#c98a5a'];

export default function LeagueCards({ leagues }) {
  const box = useRef(null);
  useEffect(() => {
    const el = box.current;
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const play = () => {
      el.querySelectorAll('[data-liga]').forEach((card, c) => {
        card.querySelectorAll('li').forEach((row, i) => {
          const delay = c * 90 + i * 70;
          row.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay, easing: 'ease-out', fill: 'backwards' });
          const pts = row.querySelector('[data-pont]');
          const to = Number(pts?.dataset.pont);
          if (pts && Number.isFinite(to) && to > 0) {
            const start = performance.now() + delay + 100;
            pts.textContent = '0';
            const step = (now) => { const p = Math.min(1, Math.max(0, (now - start) / 850)); pts.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(step); };
            requestAnimationFrame(step);
          }
          row.querySelector('[data-lep]')?.animate([{ transform: 'none' }, { transform: 'translateY(-5px) scale(1.3)' }, { transform: 'none' }], { duration: 440, delay: delay + 900, easing: 'cubic-bezier(0.3, 1.6, 0.5, 1)' });
        });
      });
    };
    const io = new IntersectionObserver((entries) => { if (entries.some(e => e.isIntersecting)) { io.disconnect(); play(); } }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={box} className={s.leagues} data-ligak data-count={leagues.length} data-reveal>
      {leagues.map(l => {
        const logo = getGameConfig(l.category)?.logo || DEFAULT_GAME_LOGO;
        return (
          <article key={l.id} className={s.league} data-liga>
            <header className={s.leagueHead}>
              <span className={s.leagueLogo}>{/* a játéklogók a naptár képei (public/jatekok), nem a weboldaléi */}<img src={logo} alt="" width={44} height={44} loading="lazy" /></span>
              <span className={s.leagueTitle}>
                <h3>{l.name || l.category}</h3>
                {l.stores?.length > 0 && <small>{l.stores.map(st => st.name).join(' · ')}</small>}
              </span>
            </header>
            {l.rows.length === 0 ? (
              <div className={s.leagueSoon} data-hamarosan>
                <b>Hamarosan indul</b>
                <span>Az első alkalom után itt lesz a ranglista. Gyere el, és szerezd meg az első pontokat!</span>
              </div>
            ) : (
            <ol className={s.leagueRows}>
              {l.rows.slice(0, TOP).map(r => (
                <li key={r.playerId}>
                  <span className={s.leagueRank} style={MEDALS[r.rank - 1] ? { background: MEDALS[r.rank - 1], color: '#0f0f0f' } : undefined}>{r.rank}</span>
                  <span className={s.leagueName}>{r.nickname}{r.rankChange ? <span className={r.rankChange > 0 ? s.leagueUp : s.leagueDown} data-lep={r.rankChange > 0 ? '' : undefined} title={r.rankChange > 0 ? `${r.rankChange} helyet lépett előre` : `${-r.rankChange} helyet esett vissza`}>{r.rankChange > 0 ? '▲' : '▼'}{Math.abs(r.rankChange)}</span> : r.isNew ? <span className={s.leagueNew}>ÚJ</span> : null}</span>
                  {r.delta > 0 && <span className={s.leagueDelta}>+{r.delta}</span>}
                  <b className={s.leaguePts} data-pont={r.points}>{r.points}</b>
                </li>
              ))}
            </ol>
            )}
            <a className={s.leagueLink} href={leagueUrl(l)} data-cal="" data-title={l.name || l.category}>{l.rows.length ? 'Teljes ranglista ›' : 'A liga oldala ›'}</a>
          </article>
        );
      })}
    </div>
  );
}
