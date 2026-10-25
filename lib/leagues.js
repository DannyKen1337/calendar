// Ligák: közös, kliens- és szerveroldalon is használható logika (pontszámítás, ranglista, ellenőrzés).
// Adatbázis: leagues (játékonként egy liga, benne a pontozás és a publikált ranglista),
// league_players (teljes név, becenév, e-mail), league_sessions (alkalmak, játékosonként a szervező által beírt ponttal).
// A játékosok a liga boltjainak eseményeiről automatikusan bekerülnek (lib/leagueSync.js), a pontokat viszont mindig kézzel írják be.
// A ranglistát a piszkozatból mindig újraszámoljuk; a játékosok csak a publikáláskor elmentett pillanatképet látják.
import { GAME_CONFIG } from '@/lib/gameConfig';
import { STORE_NAMES } from '@/lib/permissions';

// A régi (megjelenés / győzelem / döntetlen / vereség alapú) pontozás: csak a korábban így rögzített alkalmak pontjához kell
export const DEFAULT_RULES = { attendance: 1, win: 3, draw: 1, loss: 0 };
export const POINTS_MAX = 9999;    // egy játékos pontja egy alkalommal (lehet negatív is, pl. büntetés)
export const LEAGUE_NAME_MAX = 80;

// Az automatikus beemelés boltjai (a STORE_NAMES kulcsai); üres lista = nincs automatikus beemelés
export function sanitizeLeagueStores(input) {
  if (!Array.isArray(input)) return null;
  return [...new Set(input.map(String))].filter(s => STORE_NAMES[s]);
}
export const SESSION_TITLE_MAX = 80;

// URL-barát játéknév: "Magic: The Gathering" => "magic-the-gathering", "Pokémon TCG" => "pokemon-tcg"
export const gameSlug = (category) => String(category || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const categoryFromSlug = (slug) => Object.keys(GAME_CONFIG).find(c => gameSlug(c) === slug) || null;
export const leagueUrl = (category) => `/liga/${gameSlug(category)}`;

const toInt = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
const intIn = (v, min, max) => { const n = toInt(v); return Number.isInteger(n) && n >= min && n <= max ? n : null; };

// Becenév: 2-24 karakter (betű, szám, szóköz, pont, aláhúzás, kötőjel) – ez látszik a ranglistán
export function normalizeNickname(value) {
  const s = String(value ?? '').trim().replace(/\s+/g, ' ');
  return /^[\p{L}\p{N} ._-]{2,24}$/u.test(s) ? s : null;
}
// Összehasonlításhoz: kis- és nagybetű, ékezet nem számít
export const nicknameKey = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Riot-azonosító ("Név#TAG"), pl. a Riftbound oldalról beemelt játékosoknál. null, ha üres vagy érvénytelen.
export function normalizeRiotId(value) {
  const s = String(value ?? '').trim().replace(/\s+/g, ' ');
  const m = s.match(/^(.{1,40})#([\p{L}\p{N}]{1,10})$/u);
  return m ? `${m[1].trim()}#${m[2]}` : null;
}
export const riotIdKey = (s) => String(s || '').normalize('NFC').toLowerCase().trim();

// Becenév a Riot-név alapján: csak a megengedett karakterek, legfeljebb 24 karakter
export function nicknameFromRiotName(displayName, tag) {
  const clean = (x) => String(x || '').replace(/[^\p{L}\p{N} ._-]/gu, '').replace(/\s+/g, ' ').trim();
  let n = clean(displayName).slice(0, 24).trim();
  if (n.length < 2) n = clean(`${displayName} ${tag}`).slice(0, 24).trim();
  return n.length >= 2 ? n : null;
}

// Játékos adatai. Kézi felvételnél a teljes név és az e-mail kötelező. Nem kötelezők, ha van Riot-azonosító
// (Riftbound eseményből beemelt játékos), vagy ha a játékos automatikusan, egy esemény jelentkezői közül került be (relaxed).
export function sanitizePlayer(input, { relaxed = false } = {}) {
  const fullName = String(input?.fullName ?? '').trim().replace(/\s+/g, ' ');
  const nickname = normalizeNickname(input?.nickname);
  const email = String(input?.email ?? '').trim().toLowerCase();
  const rawRiot = String(input?.riotId ?? '').trim();
  const riotId = rawRiot ? normalizeRiotId(rawRiot) : null;
  if (rawRiot && !riotId) return { error: 'A Riot-azonosító formája: Név#TAG (pl. Flagger#7777).', field: 'riotId' };
  if (fullName.length > 120 || (!fullName && !riotId && !relaxed)) return { error: 'Add meg a játékos teljes nevét.', field: 'fullName' };
  if (!nickname) return { error: 'A becenév 2-24 karakter lehet (betű, szám, szóköz, pont, aláhúzás, kötőjel).', field: 'nickname' };
  if (email ? (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) : !riotId && !relaxed) return { error: 'Érvényes e-mail címet adj meg.', field: 'email' };
  return { player: { fullName, nickname, email: email || null, riotId } };
}

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(`${s}T00:00:00Z`).getTime());

// Egy alkalom ellenőrzése. validPlayerIds: a liga játékosai. Játékosonként a szervező által beírt pont számít:
// akinél van pont (0 is), az részt vett az alkalmon; akinél üres, az nem.
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
    if (r.points === null || r.points === undefined || r.points === '') continue;
    const points = intIn(r.points, -POINTS_MAX, POINTS_MAX);
    if (points === null) return { error: `A pont -${POINTS_MAX} és ${POINTS_MAX} közötti egész szám lehet.` };
    seen.add(playerId);
    results.push({ playerId, attended: true, points });
  }
  return { session: { date, title, results } };
}

// Egy eredmény pontja: a beírt pont; a régi (győzelem / döntetlen / vereség alapú) eredményeknél a szabályok szerint számolva
export const hasManualPoints = (r) => Number.isInteger(r?.points);
export const resultPoints = (r, rules = DEFAULT_RULES) => (hasManualPoints(r)
  ? r.points
  : (r.attended ? rules.attendance : 0) + (r.wins || 0) * rules.win + (r.draws || 0) * rules.draw + (r.losses || 0) * rules.loss + (r.bonus || 0));

// Állás a piszkozatból: pont szerint csökkenő, holtversenyben azonos helyezés (1, 2, 2, 4).
// Holtversenyen belül a több alkalom, majd a becenév dönt a sorrendről.
// Csak az kerül az állásba, akinek már van eredménye (az eseményekről beemelt, még nem pontozott játékos nem).
export function computeStandings(rules, players, sessions) {
  const stats = new Map(players.map(p => [String(p.id), { playerId: String(p.id), nickname: p.nickname, points: 0, sessions: 0, wins: 0, draws: 0, losses: 0, legacy: false, hasResults: false }]));
  for (const s of sessions) {
    for (const r of s.results || []) {
      const st = stats.get(String(r.playerId));
      if (!st) continue;
      st.hasResults = true;
      st.points += resultPoints(r, rules);
      if (r.attended) st.sessions++;
      if (!hasManualPoints(r)) { st.legacy = true; st.wins += r.wins || 0; st.draws += r.draws || 0; st.losses += r.losses || 0; }
    }
  }
  const rows = [...stats.values()].filter(r => r.hasResults)
    .sort((a, b) => b.points - a.points || b.sessions - a.sessions || a.nickname.localeCompare(b.nickname, 'hu'));
  rows.forEach((row, i) => { row.rank = i > 0 && rows[i - 1].points === row.points ? rows[i - 1].rank : i + 1; });
  return rows;
}

// Publikálandó pillanatkép: csak nyilvános adatok (becenév, pont, helyezés, alkalmak), a legutóbbi publikálás óta
// kapott pont (delta) és a helyezésváltozás (rankChange: pozitív = előrelépett, null = új a ranglistán vagy első publikálás).
// Győzelem / döntetlen / vereség csak a régi pontozással rögzített eredményeknél van, egyébként null.
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
      wins: r.legacy ? r.wins : null,
      draws: r.legacy ? r.draws : null,
      losses: r.legacy ? r.losses : null,
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
