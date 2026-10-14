// Ligák: szerveroldali adatbetöltés a nyilvános oldalakhoz (csak a publikált ranglista, személyes adatok nélkül)
import { getTavernDb } from '@/lib/mongodb';
import { PREORDER_GAMES } from '@/lib/preorders';

// A nyilvános ranglista adatai: liga neve, játék, frissítés ideje és a publikált sorok (becenév, helyezés, pont, delta)
const publicLeague = (l) => ({
  id: String(l._id),
  category: l.category,
  name: l.name,
  publishedAt: l.published?.at ? new Date(l.published.at).toISOString() : null,
  rows: (l.published?.rows || []).map(r => ({ playerId: r.playerId, nickname: r.nickname, rank: r.rank, points: r.points, delta: r.delta })),
});

const gameOrder = (c) => { const i = PREORDER_GAMES.indexOf(c); return i === -1 ? PREORDER_GAMES.length : i; };

export async function getPublishedLeagues() {
  const db = await getTavernDb();
  const leagues = await db.collection('leagues').find({ 'published.at': { $exists: true } }, { projection: { category: 1, name: 1, published: 1 } }).toArray();
  return leagues.map(publicLeague).sort((a, b) => gameOrder(a.category) - gameOrder(b.category));
}

export async function getPublishedLeague(category) {
  const db = await getTavernDb();
  const league = await db.collection('leagues').findOne({ category, 'published.at': { $exists: true } }, { projection: { category: 1, name: 1, published: 1 } });
  return league ? publicLeague(league) : null;
}
