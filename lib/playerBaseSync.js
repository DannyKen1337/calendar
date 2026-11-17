// A játékos bázis feltöltése a jelentkezésekből (lib/playerBase.js az egyezés szabályai). A játékos bázis oldal
// betöltésekor fut, és csak az előző futás óta érkezett jelentkezéseket nézi (az első futás az összeset). Zárolással:
// egyszerre csak egy futhat. Forrás: a saját jelentkezések (registrations: felhasználónév, teljes név, e-mail; az
// esemény játéka a tournaments-ből) és a Riftbound külső jelentkezők (external_registrations: idézőnév).
// A törölt játékos csak akkor kerül vissza, ha újra jelentkezik.
import { ObjectId } from 'mongodb';
import { entryFrom, findMatch, mergeEntry, newPlayer, RIFTBOUND } from '@/lib/playerBase';

export const PLAYERS = 'players';
const STATE = 'player_base_sync';

export async function syncPlayerBase(db) {
  const settings = db.collection('settings');
  const now = new Date();
  await settings.updateOne({ _id: STATE }, { $setOnInsert: { at: new Date(0), lockUntil: new Date(0) } }, { upsert: true });
  const state = await settings.findOneAndUpdate({ _id: STATE, lockUntil: { $lt: now } }, { $set: { lockUntil: new Date(now.getTime() + 60000) } });
  if (!state) return { skipped: true }; // épp fut egy másik
  const since = state.at || new Date(0);
  try {
    const regs = await db.collection('registrations').find({ date: { $gt: since, $lte: now } }, { projection: { tournamentId: 1, username: 1, name: 1, email: 1, date: 1 } }).toArray();
    const ext = await db.collection('external_registrations').find({ firstSeenAt: { $gt: since, $lte: now } }, { projection: { tournamentId: 1, name: 1, firstSeenAt: 1, registeredAt: 1 } }).toArray();
    const tids = [...new Set([...regs, ...ext].map(r => String(r.tournamentId)))].filter(id => ObjectId.isValid(id) && id.length === 24);
    const events = new Map((await db.collection('tournaments').find({ _id: { $in: tids.map(id => new ObjectId(id)) } }, { projection: { name: 1, category: 1, date: 1 } }).toArray()).map(t => [String(t._id), t]));

    // Játékonként: a bejegyzések időrendben
    const byGame = new Map();
    const add = (category, entry, seen) => { if (!entry) return; if (!byGame.has(category)) byGame.set(category, []); byGame.get(category).push({ entry, seen }); };
    for (const r of regs) {
      const ev = events.get(String(r.tournamentId));
      if (!ev?.category) continue;
      add(ev.category, entryFrom(ev.category, r), { at: r.date, event: ev.name });
    }
    for (const r of ext) {
      const ev = events.get(String(r.tournamentId));
      add(RIFTBOUND, entryFrom(RIFTBOUND, { summoner: r.name }), { at: r.registeredAt || r.firstSeenAt, event: ev?.name || '' });
    }

    const col = db.collection(PLAYERS);
    let added = 0, updated = 0;
    for (const [category, items] of byGame) {
      items.sort((a, b) => new Date(a.seen.at) - new Date(b.seen.at));
      const players = await col.find({ category }).toArray();
      const changed = new Map(); // _id (vagy ideiglenes kulcs) => játékos
      for (const { entry, seen } of items) {
        const match = findMatch(players, entry, category);
        if (match) {
          const merged = mergeEntry(match, entry, seen);
          Object.assign(match, merged);
          changed.set(match._id ? String(match._id) : match._tmp, match);
        } else {
          const p = { ...newPlayer(category, entry, seen), createdAt: now, _tmp: `uj${players.length}` };
          players.push(p);
          changed.set(p._tmp, p);
        }
      }
      const ops = [...changed.values()].map(({ _id, _tmp, ...p }) => (_id
        ? { updateOne: { filter: { _id }, update: { $set: { ...p, updatedAt: now } } } }
        : { insertOne: { document: { ...p, updatedAt: now } } }));
      if (ops.length) {
        const res = await col.bulkWrite(ops, { ordered: false });
        added += res.insertedCount; updated += res.modifiedCount;
      }
    }
    await settings.updateOne({ _id: STATE }, { $set: { at: now, lockUntil: new Date(0), last: { added, updated } } });
    return { added, updated };
  } catch (err) {
    await settings.updateOne({ _id: STATE }, { $set: { lockUntil: new Date(0) } });
    throw err;
  }
}
