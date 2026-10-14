// Ligák: közös, kliens- és szerveroldalon is használható logika (pontszámítás, ranglista, ellenőrzés).
// Adatbázis: leagues (játékonként egy liga, benne a pontozás és a publikált ranglista),
// league_players (teljes név, becenév, e-mail), league_sessions (alkalmak, játékosonkénti eredményekkel).
// A ranglistát a piszkozatból mindig újraszámoljuk; a játékosok csak a publikáláskor elmentett pillanatképet látják.
import { GAME_CONFIG } from '@/lib/gameConfig';

export const DEFAULT_RULES = { attendance: 1, win: 3, draw: 1, loss: 0 };
export const RULE_FIELDS = [
  { key: 'attendance', label: 'Megjelenés' },
  { key: 'win', label: 'Győzelem' },
  { key: 'draw', label: 'Döntetlen' },
  { key: 'loss', label: 'Vereség' },
];
export const RULE_MAX = 1000;
export const RESULT_MAX = 99;      // győzelem / döntetlen / vereség egy alkalommal
export const BONUS_MAX = 999;      // bónusz (lehet negatív is, pl. büntetés)
export const LEAGUE_NAME_MAX = 80;
export const SESSION_TITLE_MAX = 80;

// URL-barát játéknév: "Magic: The Gathering" => "magic-the-gathering", "Pokémon TCG" => "pokemon-tcg"
export const gameSlug = (category) => String(category || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const categoryFromSlug = (slug) => Object.keys(GAME_CONFIG).find(c => gameSlug(c) === slug) || null;
export const leagueUrl = (category) => `/liga/${gameSlug(category)}`;

const toInt = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
const intIn = (v, min, max) => { const n = toInt(v); return Number.isInteger(n) && n >= min && n <= max ? n : null; };

export function sanitizeRules(input) {
  const rules = {};
  for (const { key, label } of RULE_FIELDS) {
    const n = intIn(input?.[key], 0, RULE_MAX);
    if (n === null) return { error: `${label}: 0 és ${RULE_MAX} közötti egész számot adj meg.` };
    rules[key] = n;
  }
  return { rules };
}

export const ruleSummary = (rules) => RULE_FIELDS.map(f => `${f.label}: ${rules?.[f.key] ?? 0}`).join(' · ');

// Becenév: 2-24 karakter (betű, szám, szóköz, pont, aláhúzás, kötőjel) – ez látszik a ranglistán
export function normalizeNickname(value) {
  const s = String(value ?? '').trim().replace(/\s+/g, ' ');
  return /^[\p{L}\p{N} ._-]{2,24}$/u.test(s) ? s : null;
}
// Összehasonlításhoz: kis- és nagybetű, ékezet nem számít
export const nicknameKey = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export function sanitizePlayer(input) {
  const fullName = String(input?.fullName ?? '').trim().replace(/\s+/g, ' ');
  const nickname = normalizeNickname(input?.nickname);
  const email = String(input?.email ?? '').trim().toLowerCase();
  if (!fullName || fullName.length > 120) return { error: 'Add meg a játékos teljes nevét.', field: 'fullName' };
  if (!nickname) return { error: 'A becenév 2-24 karakter lehet (betű, szám, szóköz, pont, aláhúzás, kötőjel).', field: 'nickname' };
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Érvényes e-mail címet adj meg.', field: 'email' };
  return { player: { fullName, nickname, email } };
}

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(`${s}T00:00:00Z`).getTime());

// Egy alkalom ellenőrzése. validPlayerIds: a liga játékosai. Csak azok az eredménysorok maradnak meg,
// amelyekben van megjelenés vagy bármilyen érték; aki játszott (győzelem/döntetlen/vereség), az megjelentnek számít.
export function sanitizeSession(input, validPlayerIds) {
  const date = String(input?.date ?? '');
  const title = String(input?.title ?? '').trim().replace(/\s+/g, ' ');
  if (!isDate(date)) return { error: 'Adj meg dátumot.' };
  if (title.length > SESSION_TITLE_MAX) return { error: `A megnevezés legfeljebb ${SESSION_TITLE_MAX} karakter lehet.` };
  const results = [];
  const seen = new Set();
  for (const r of Array.isArray(input?.results) ? input.results : []) {
    const playerId = String(r?.playerId ?? '');
    if (!validPlayerIds.has(playerId) || seen.has(playerId)) continue;
    const wins = intIn(r.wins ?? 0, 0, RESULT_MAX);
    const draws = intIn(r.draws ?? 0, 0, RESULT_MAX);
    const losses = intIn(r.losses ?? 0, 0, RESULT_MAX);
    const bonus = intIn(r.bonus ?? 0, -BONUS_MAX, BONUS_MAX);
    if (wins === null || draws === null || losses === null) return { error: `A győzelem, döntetlen és vereség 0 és ${RESULT_MAX} közötti egész szám lehet.` };
    if (bonus === null) return { error: `A bónusz -${BONUS_MAX} és ${BONUS_MAX} közötti egész szám lehet.` };
    const attended = r.attended === true || wins + draws + losses > 0;
    if (!attended && bonus === 0) continue;
    seen.add(playerId);
    results.push({ playerId, attended, wins, draws, losses, bonus });
  }
  return { session: { date, title, results } };
}

export const resultPoints = (r, rules) =>
  (r.attended ? rules.attendance : 0) + r.wins * rules.win + r.draws * rules.draw + r.losses * rules.loss + (r.bonus || 0);

// Állás a piszkozatból: pont szerint csökkenő, holtversenyben azonos helyezés (1, 2, 2, 4).
// Holtversenyen belül a több győzelem, majd a becenév dönt a sorrendről.
export function computeStandings(rules, players, sessions) {
  const stats = new Map(players.map(p => [String(p.id), { playerId: String(p.id), nickname: p.nickname, points: 0, sessions: 0, wins: 0, draws: 0, losses: 0 }]));
  for (const s of sessions) {
    for (const r of s.results || []) {
      const st = stats.get(String(r.playerId));
      if (!st) continue;
      st.points += resultPoints(r, rules);
      if (r.attended) st.sessions++;
      st.wins += r.wins; st.draws += r.draws; st.losses += r.losses;
    }
  }
  const rows = [...stats.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || a.nickname.localeCompare(b.nickname, 'hu'));
  rows.forEach((row, i) => { row.rank = i > 0 && rows[i - 1].points === row.points ? rows[i - 1].rank : i + 1; });
  return rows;
}

// Publikálandó pillanatkép: csak nyilvános adatok (becenév, pont, helyezés, eredmények), a legutóbbi publikálás óta
// kapott pont (delta) és a helyezésváltozás (rankChange: pozitív = előrelépett, null = új a ranglistán vagy első publikálás)
export function buildSnapshot(standings, previousRows) {
  const prev = new Map((previousRows || []).map(r => [r.playerId, r]));
  const hasPrevious = (previousRows || []).length > 0;
  return standings.map(r => {
    const p = prev.get(r.playerId);
    return {
      playerId: r.playerId,
      nickname: r.nickname,
      rank: r.rank,
      points: r.points,
      delta: r.points - (p?.points ?? 0),
      rankChange: hasPrevious && p ? p.rank - r.rank : null,
      isNew: hasPrevious && !p,
      sessions: r.sessions,
      wins: r.wins,
      draws: r.draws,
      losses: r.losses,
    };
  });
}

// Van-e a publikálthoz képest változás (pont, helyezés, becenév vagy játékoslista)
export function hasUnpublishedChanges(snapshot, publishedRows) {
  if (!publishedRows) return snapshot.length > 0;
  if (snapshot.length !== publishedRows.length) return true;
  const pub = new Map(publishedRows.map(r => [r.playerId, r]));
  return snapshot.some(r => { const p = pub.get(r.playerId); return !p || p.points !== r.points || p.rank !== r.rank || p.nickname !== r.nickname; });
}
