// Ligák: szerveroldali adatbetöltés a nyilvános oldalakhoz (csak a publikált ranglista, személyes adatok nélkül)
import { getTavernDb } from '@/lib/mongodb';
import { PREORDER_GAMES } from '@/lib/preorders';
import { toObjectId } from '@/lib/preorderData';

// Egy ranglistasor nyilvános mezői (csak becenév és eredmények, személyes adat nélkül)
export const publicRow = (r) => ({
  playerId: r.playerId, nickname: r.nickname, rank: r.rank, points: r.points, delta: r.delta ?? 0,
  rankChange: r.rankChange ?? null, isNew: !!r.isNew,
  sessions: r.sessions ?? null, wins: r.wins ?? null, draws: r.draws ?? null, losses: r.losses ?? null,
});

// A nyilvános ranglista adatai: liga neve, játék, frissítés ideje és a publikált sorok (becenév, helyezés, pont, delta)
const publicLeague = (l) => ({
  id: String(l._id),
  category: l.category,
  name: l.name,
  publishedAt: l.published?.at ? new Date(l.published.at).toISOString() : null,
  rows: (l.published?.rows || []).map(publicRow),
});

const gameOrder = (c) => { const i = PREORDER_GAMES.indexOf(c); return i === -1 ? PREORDER_GAMES.length : i; };

const seasonOut = (s) => ({ id: String(s._id), name: s.name, closedAt: s.closedAt ? new Date(s.closedAt).toISOString() : null });

// A nyilvános ligák listája: a publikált ranglistával rendelkező ligák, illetve azok, amelyeknek van archív szezonja
export async function getPublishedLeagues() {
  const db = await getTavernDb();
  const [leagues, seasons] = await Promise.all([
    db.collection('leagues').find({}, { projection: { category: 1, name: 1, published: 1 } }).toArray(),
    db.collection('league_seasons').find({}, { projection: { leagueId: 1, name: 1, closedAt: 1 } }).sort({ closedAt: -1 }).toArray(),
  ]);
  return leagues
    .map(l => ({ ...publicLeague(l), isPublished: !!l.published?.at, seasons: seasons.filter(s => s.leagueId === String(l._id)).map(seasonOut) }))
    .filter(l => l.isPublished || l.seasons.length > 0)
    .sort((a, b) => gameOrder(a.category) - gameOrder(b.category));
}

// Egy játék ligája: az aktuális publikált ranglista (ha van) és a korábbi szezonok listája. null, ha egyik sincs.
export async function getPublishedLeague(category) {
  const db = await getTavernDb();
  const league = await db.collection('leagues').findOne({ category }, { projection: { category: 1, name: 1, published: 1 } });
  if (!league) return null;
  const seasons = await db.collection('league_seasons').find({ leagueId: String(league._id) }, { projection: { name: 1, closedAt: 1 } }).sort({ closedAt: -1 }).toArray();
  const isPublished = !!league.published?.at;
  if (!isPublished && seasons.length === 0) return null;
  return { ...publicLeague(league), isPublished, seasons: seasons.map(seasonOut) };
}

// Egy archív szezon végeredménye (csak becenevek)
export async function getSeason(category, seasonId) {
  const oid = toObjectId(seasonId);
  if (!oid) return null;
  const db = await getTavernDb();
  const s = await db.collection('league_seasons').findOne({ _id: oid, category });
  if (!s) return null;
  return { id: String(s._id), category: s.category, name: s.name, closedAt: s.closedAt ? new Date(s.closedAt).toISOString() : null, sessionCount: s.sessionCount || 0, rows: (s.rows || []).map(publicRow) };
}
