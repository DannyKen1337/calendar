import { getGameConfig, getGameColor } from '@/lib/gameConfig';

const DEFAULT_LOGO = 'https://cdn-icons-png.flaticon.com/512/6729/6729800.png';
const MEDALS = { 1: '#E5B15D', 2: '#C0C0C8', 3: '#C8875A' };

export const formatPublishedAt = (iso) => (iso
  ? new Date(iso).toLocaleString('hu-HU', { timeZone: 'Europe/Budapest', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '');

// A legutóbbi publikálás óta kapott pont, a sor végén kis felirattal
function Delta({ value }) {
  const color = value > 0 ? '#8fd18f' : value < 0 ? '#ff9b9b' : '#6f6466';
  const text = value > 0 ? `+${value} pont` : value < 0 ? `−${Math.abs(value)} pont` : '+0 pont';
  return <span className="text-xs md:text-sm whitespace-nowrap tabular-nums w-16 md:w-20 text-right shrink-0" style={{ color }}>{text}</span>;
}

// Helyezésváltozás a legutóbbi publikáláshoz képest: ▲2 (előrelépett), ▼1 (visszaesett), ÚJ (most került a ranglistára)
function RankChange({ row }) {
  if (row.isNew) return <span className="text-[10px] font-bold px-1.5 rounded" style={{ color: '#8fc7ff', border: '1px solid #8fc7ff55' }} title="Új a ranglistán">ÚJ</span>;
  if (!row.rankChange) return null;
  const up = row.rankChange > 0;
  return (
    <span className="text-xs font-bold tabular-nums" style={{ color: up ? '#8fd18f' : '#ff9b9b' }} title={up ? `${row.rankChange} helyet lépett előre` : `${-row.rankChange} helyet esett vissza`}>
      {up ? '▲' : '▼'}{Math.abs(row.rankChange)}
    </span>
  );
}

const hasDetails = (r) => r.sessions !== null && r.sessions !== undefined;

// Ranglista: helyezés, becenév, pont és a legutóbbi frissítés óta kapott pont. Egy sorra kattintva (koppintva)
// lenyílnak a játékos eredményei. A nyilvános oldal és az admin előnézet is ezt használja, így az előnézet
// pontosan azt mutatja, amit a játékosok látnak. Szándékosan nincs benne JavaScript (a lenyitás <details> elem).
export default function Leaderboard({ league, rows, publishedAt, compact = false, subtitle = null, hideDelta = false }) {
  const color = getGameColor({ category: league.category });
  const logo = getGameConfig(league.category).logo || DEFAULT_LOGO;
  return (
    <div className="rounded-3xl border-2 bg-[#1a1012] overflow-hidden" style={{ borderColor: `${color}66`, boxShadow: `0 0 50px ${color}22` }}>
      <div className={`flex items-center gap-4 ${compact ? 'p-4' : 'p-5 md:p-6'} border-b border-[#4A2E33]`} style={{ background: `linear-gradient(135deg, ${color}33 0%, transparent 70%)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- külső játéklogók, a naptár többi részéhez hasonlóan */}
        <img src={logo} alt="" className="w-12 h-12 md:w-14 md:h-14 object-contain shrink-0" />
        <div className="min-w-0">
          <p className="uppercase tracking-[0.2em] text-xs m-0" style={{ color }}>{league.category}</p>
          <h2 className={`${compact ? 'text-xl' : 'text-2xl md:text-3xl'} font-bold font-serif text-white m-0`} style={{ overflowWrap: 'anywhere' }}>{league.name}</h2>
          {subtitle && <p className="text-xs m-0 mt-1" style={{ color }}>{subtitle}</p>}
          {publishedAt && <p className="text-xs text-[#9a8a8c] m-0 mt-1">Frissítve: {formatPublishedAt(publishedAt)}</p>}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-center text-[#6b7280] italic m-0 p-6">Még nincs játékos a ranglistán.</p>
      ) : (
        <ol className="list-none m-0 p-2 md:p-3 flex flex-col gap-1">
          <li className="flex items-center gap-3 px-3 pb-1 text-xs uppercase tracking-wider text-[#7d6e70]" aria-hidden="true">
            <span className="w-9 text-center">#</span>
            <span className="flex-1">Játékos</span>
            <span className="w-14 text-right">Pont</span>
            {!hideDelta && <span className="w-16 md:w-20" />}
          </li>
          {rows.map(r => {
            const medal = MEDALS[r.rank];
            const summary = (
              <>
                <span className="w-9 h-9 rounded-full flex items-center justify-center font-bold shrink-0 tabular-nums" style={medal ? { background: medal, color: '#1a1012' } : { color: '#baaaac', border: '1px solid #4A2E33' }}>{r.rank}</span>
                <span className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="text-white font-bold md:text-lg truncate">{r.nickname}</span>
                  <RankChange row={r} />
                </span>
                <span className="w-14 text-right font-bold text-lg md:text-xl tabular-nums" style={{ color: medal || '#E0D6C8' }}>{r.points}</span>
                {!hideDelta && <Delta value={r.delta} />}
              </>
            );
            const rowStyle = { background: medal ? `${medal}14` : '#2B1A1C' };
            return (
              <li key={r.playerId} className="rounded-xl" style={rowStyle}>
                {hasDetails(r) ? (
                  <details className="group">
                    <summary className="flex items-center gap-3 px-3 py-2.5 cursor-pointer list-none [&::-webkit-details-marker]:hidden rounded-xl hover:bg-white/5" title="Részletek">
                      {summary}
                    </summary>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 px-3 pb-3 pl-[3.75rem] text-sm text-[#baaaac]">
                      <span>Alkalom: <b className="text-[#E0D6C8]">{r.sessions}</b></span>
                      {r.wins !== null && r.wins !== undefined && <span>Győzelem: <b className="text-[#E0D6C8]">{r.wins}</b></span>}
                      {r.draws !== null && r.draws !== undefined && <span>Döntetlen: <b className="text-[#E0D6C8]">{r.draws}</b></span>}
                      {r.losses !== null && r.losses !== undefined && <span>Vereség: <b className="text-[#E0D6C8]">{r.losses}</b></span>}
                    </div>
                  </details>
                ) : (
                  <div className="flex items-center gap-3 px-3 py-2.5">{summary}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
