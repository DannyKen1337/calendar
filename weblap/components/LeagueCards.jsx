import { getGameConfig, DEFAULT_GAME_LOGO } from '@/lib/gameConfig';
import { leagueUrl } from '@/lib/leagues';
import s from '@/weblap/fooldal.module.css';

// A Ligák mező ranglistái: liganként egy kártya (játéklogó, liga neve, az élmezőny, link a teljes ranglistára).
// 2–4 ligára készült: 2 ligánál két, 3-nál három oszlop, 4-nél széles képernyőn négy, közepesen 2×2; telefonon egymás
// alatt, liganként az első három. A teljes ranglista a naptár /liga oldalán, az oldalon belüli naptárablakban nyílik.
// leagues: a publikált ligák (lib/leagueData.js: getPublishedLeagues), legfeljebb 4
const TOP = 5;
const MEDALS = ['#e5b15d', '#c9ccd1', '#c98a5a'];

export default function LeagueCards({ leagues }) {
  return (
    <div className={s.leagues} data-ligak data-count={leagues.length} data-reveal>
      {leagues.map(l => {
        const logo = getGameConfig(l.category)?.logo || DEFAULT_GAME_LOGO;
        return (
          <article key={l.id} className={s.league} data-liga>
            <header className={s.leagueHead}>
              <span className={s.leagueLogo}>{/* a játéklogók a naptár képei (public/jatekok), nem a weboldaléi */}{/* eslint-disable-next-line @next/next/no-img-element */}<img src={logo} alt="" width={44} height={44} loading="lazy" /></span>
              <h3>{l.name || l.category}</h3>
            </header>
            <ol className={s.leagueRows}>
              {l.rows.slice(0, TOP).map(r => (
                <li key={r.playerId}>
                  <span className={s.leagueRank} style={MEDALS[r.rank - 1] ? { background: MEDALS[r.rank - 1], color: '#0f0f0f' } : undefined}>{r.rank}</span>
                  <span className={s.leagueName}>{r.nickname}</span>
                  <b className={s.leaguePts}>{r.points}</b>
                </li>
              ))}
            </ol>
            <a className={s.leagueLink} href={leagueUrl(l.category)} data-cal="" data-title={l.name || l.category}>Teljes ranglista ›</a>
          </article>
        );
      })}
    </div>
  );
}
