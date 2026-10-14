// Személyes adatok automatikus törlése (a heti takarítás hívja, lásd app/api/cron/cleanup).
// - Előrendelés: a lezárt termék a jelentkezőivel együtt a lezárás után PREORDER_RETENTION_MONTHS hónappal törlődik.
// - Liga: a játékos (teljes név, e-mail) törlődik, ha LEAGUE_PLAYER_RETENTION_MONTHS hónapja nem jelent meg egy alkalmon sem
//   (és legalább ennyi ideje vették fel). A publikált és archív ranglistákban csak a becenév marad meg.

export const PREORDER_RETENTION_MONTHS = 6;
export const LEAGUE_PLAYER_RETENTION_MONTHS = 12;

const monthsAgo = (n, now = new Date()) => { const d = new Date(now); d.setMonth(d.getMonth() - n); return d; };
const dayString = (d) => d.toISOString().slice(0, 10);

export async function deleteExpiredPreorders(db, now = new Date()) {
  const limit = monthsAgo(PREORDER_RETENTION_MONTHS, now);
  const products = await db.collection('preorder_products').find({ isOpen: false, closedAt: { $lt: limit } }, { projection: { name: 1 } }).toArray();
  if (!products.length) return { products: 0, preorders: 0 };
  const ids = products.map(p => String(p._id));
  const removed = await db.collection('preorders').deleteMany({ productId: { $in: ids } });
  await db.collection('preorder_products').deleteMany({ _id: { $in: products.map(p => p._id) } });
  return { products: products.length, preorders: removed.deletedCount, names: products.map(p => p.name) };
}

export async function deleteInactiveLeaguePlayers(db, now = new Date()) {
  const limit = monthsAgo(LEAGUE_PLAYER_RETENTION_MONTHS, now);
  const limitDay = dayString(limit);
  const candidates = await db.collection('league_players').find({ createdAt: { $lt: limit } }, { projection: { leagueId: 1, nickname: 1 } }).toArray();
  if (!candidates.length) return 0;
  // Aki a határidő után bármelyik alkalmon megjelent, az aktív
  const recent = await db.collection('league_sessions').find({ date: { $gte: limitDay } }, { projection: { results: 1 } }).toArray();
  const active = new Set(recent.flatMap(s => (s.results || []).filter(r => r.attended).map(r => r.playerId)));
  const inactive = candidates.filter(p => !active.has(String(p._id)));
  if (!inactive.length) return 0;
  const ids = inactive.map(p => String(p._id));
  await db.collection('league_sessions').updateMany({}, { $pull: { results: { playerId: { $in: ids } } } });
  await db.collection('league_players').deleteMany({ _id: { $in: inactive.map(p => p._id) } });
  return inactive.length;
}
