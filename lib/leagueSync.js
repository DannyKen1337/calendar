// Ligák: új játékosok automatikus beemelése a liga játékának eseményeiről (csak szerveroldalon).
// A liga beállításaiban kiválasztott boltok (leagues.autoStores) eseményeit nézi a szezon kezdetétől (a jövőbelieket is),
// és minden aktív jelentkezőt felvesz, aki még nincs a ligában (várólista és lejelentkezett nem):
//  - a naptárban jelentkezők (registrations): e-mail alapján, e-mail nélkül név alapján ismeri fel őket;
//  - a Riftbound oldalas események jelentkezői (external_registrations): Riftbound- vagy Riot-azonosító alapján.
// Pontot nem ad: a pontokat mindig a szervező írja be. A játékosnál megjegyzi, mely eseményekre jelentkezett
// (league_players.eventIds), így az alkalom rögzítésekor az esemény jelentkezői kiemelhetők.
// A szervező által törölt játékos nem kerül vissza (leagues.ignoredPlayers), amíg a beállításokban vissza nem engedik.
import { eventStore } from '@/lib/permissions';
import { budapestDateTime } from '@/lib/eventDates';
import { normalizeNickname, nicknameKey, riotIdKey, nicknameFromRiotName } from '@/lib/leagues';

const LOCK_MS = 30 * 1000;
const MIN_INTERVAL_MS = 30 * 1000; // egy ligát legfeljebb ennyi időnként nézünk át
const ACTIVE_STATUSES = ['Aktív', 'Active'];

// A szezon első napja (Budapest szerint): ettől kezdve számítanak az események
export const leagueSeasonStart = (league) => budapestDateTime(new Date(league.seasonStartedAt || league.createdAt || Date.now()).getTime()).slice(0, 10);

// A játékos azonosító kulcsai (a kizárási listához és a felismeréshez)
export function playerKeys(p) {
  const keys = [];
  if (p.email) keys.push(`e:${String(p.email).toLowerCase()}`);
  if (p.rgnPlayerId) keys.push(`r:${p.rgnPlayerId}`);
  if (p.riotId) keys.push(`i:${riotIdKey(p.riotId)}`);
  if (!p.email && !p.riotId) keys.push(`n:${nicknameKey(p.fullName || p.nickname)}`);
  return keys;
}

// A liga eseményei: a játék eseményei a kiválasztott boltokban, a szezon kezdetétől
export async function leagueEvents(db, league, projection = { name: 1, date: 1, store: 1, external_url: 1 }) {
  const stores = new Set(league.autoStores || []);
  if (!stores.size) return [];
  const events = await db.collection('tournaments').find({ category: league.category, date: { $gte: leagueSeasonStart(league) } }, { projection: { ...projection, store: 1 } }).toArray();
  return events.filter(e => stores.has(eventStore(e)));
}

// Egyedi becenév a ligán belül (foglaltnál sorszámmal)
function uniqueNickname(base, taken) {
  let nick = normalizeNickname(base) || 'Játékos';
  if (!taken.has(nicknameKey(nick))) return nick;
  for (let i = 2; i < 1000; i++) {
    const alt = `${nick.slice(0, 24 - String(i).length - 1)} ${i}`;
    if (!taken.has(nicknameKey(alt))) return alt;
  }
  return `${nick.slice(0, 15)} ${Date.now() % 100000}`;
}

// Egy liga szinkronizálása. Visszatérés: { added, names } (skipped: true, ha most nem kellett / nem lehetett futnia)
export async function syncLeaguePlayers(db, league, { force = false } = {}) {
  if (!Array.isArray(league.autoStores) || league.autoStores.length === 0) return { added: 0, names: [], skipped: true };
  const now = new Date();
  if (!force && league.autoSyncedAt && now - new Date(league.autoSyncedAt) < MIN_INTERVAL_MS) return { added: 0, names: [], skipped: true };
  // Zárolás: egyszerre csak egy szinkron fusson ligánként (különben két admin egyszerre duplán vehetne fel valakit)
  const locked = await db.collection('leagues').updateOne(
    { _id: league._id, $or: [{ autoSyncLockUntil: { $exists: false } }, { autoSyncLockUntil: { $lt: now } }] },
    { $set: { autoSyncLockUntil: new Date(now.getTime() + LOCK_MS) } },
  );
  if (locked.matchedCount === 0) return { added: 0, names: [], skipped: true };

  try {
    const leagueId = String(league._id);
    const events = await leagueEvents(db, league);
    const eventIds = events.map(e => String(e._id));
    const [localRegs, rgnRegs, existing] = await Promise.all([
      eventIds.length ? db.collection('registrations').find(
        { tournamentId: { $in: [...eventIds, ...events.map(e => e._id)] }, status: { $in: ACTIVE_STATUSES } },
        { projection: { tournamentId: 1, name: 1, username: 1, email: 1, date: 1 } },
      ).sort({ date: 1 }).toArray() : [],
      eventIds.length ? db.collection('external_registrations').find(
        { tournamentId: { $in: eventIds }, droppedAt: null, waitlist: { $ne: true } },
        { projection: { tournamentId: 1, name: 1, playerId: 1, registeredAt: 1 } },
      ).sort({ registeredAt: 1 }).toArray() : [],
      db.collection('league_players').find({ leagueId }).toArray(),
    ]);

    const ignored = new Set(league.ignoredPlayers || []);
    const byKey = new Map();   // azonosító kulcs (e-mail, Riftbound, Riot, név) => játékos
    const byName = new Map();  // teljes név vagy becenév => játékos (e-mail nélküli jelentkezők felismeréséhez)
    const taken = new Set(existing.map(p => nicknameKey(p.nickname)));
    const index = (p) => {
      playerKeys(p).forEach(k => byKey.set(k, p));
      [p.fullName, p.nickname].filter(Boolean).forEach(n => { if (!byName.has(nicknameKey(n))) byName.set(nicknameKey(n), p); });
    };
    existing.forEach(index);
    // Játékosonként (azonosító => eseményei); az új játékosok ideiglenes azonosítót kapnak a beszúrásig
    const eventsOf = new Map(existing.map(p => [String(p._id), new Set(p.eventIds || [])]));
    const before = new Map(existing.map(p => [String(p._id), new Set(p.eventIds || [])]));
    const newDocs = [];

    const attach = (p, tournamentId) => eventsOf.get(String(p._id)).add(String(tournamentId));
    const create = (doc, tournamentId) => {
      if (playerKeys(doc).some(k => ignored.has(k))) return;
      const nickname = uniqueNickname(doc.nickname, taken);
      taken.add(nicknameKey(nickname));
      const p = { ...doc, nickname, leagueId, createdAt: now, createdBy: 'Rendszer', _id: `new${newDocs.length}` };
      newDocs.push(p);
      eventsOf.set(p._id, new Set());
      index(p);
      attach(p, tournamentId);
    };

    for (const r of localRegs) {
      const email = r.email ? String(r.email).trim().toLowerCase() : null;
      const fullName = String(r.name || '').trim().replace(/\s+/g, ' ');
      const username = String(r.username || '').trim();
      // E-mail címmel jelentkezőt csak e-mail alapján ismerünk fel (azonos nevű, de más e-mailes játékos más ember)
      const match = email ? byKey.get(`e:${email}`) : (byName.get(nicknameKey(fullName)) || (username && byName.get(nicknameKey(username))));
      if (match) { attach(match, r.tournamentId); continue; }
      const doc = { fullName: fullName && fullName !== username ? fullName : '', nickname: normalizeNickname(username) || normalizeNickname(fullName) || fullName.slice(0, 24), email, riotId: null, source: 'event' };
      create(doc, r.tournamentId);
    }

    for (const r of rgnRegs) {
      const match = (r.playerId && byKey.get(`r:${r.playerId}`)) || byKey.get(`i:${riotIdKey(r.name)}`);
      if (match) { attach(match, r.tournamentId); continue; }
      const hash = r.name.lastIndexOf('#');
      const displayName = hash > 0 ? r.name.slice(0, hash) : r.name;
      const tag = hash > 0 ? r.name.slice(hash + 1) : '';
      const doc = { fullName: '', nickname: nicknameFromRiotName(displayName, tag) || 'Játékos', email: null, riotId: r.name, rgnPlayerId: r.playerId || null, source: 'rgn' };
      create(doc, r.tournamentId);
    }

    const players = db.collection('league_players');
    if (newDocs.length) {
      await players.insertMany(newDocs.map(({ _id, ...d }) => ({ ...d, eventIds: [...eventsOf.get(_id)] })));
    }
    // A meglévő játékosoknál csak az új eseményeket írjuk hozzá
    const updates = [...before.entries()]
      .map(([id, had]) => ({ id, add: [...eventsOf.get(id)].filter(e => !had.has(e)) }))
      .filter(u => u.add.length);
    if (updates.length) {
      const byId = new Map(existing.map(p => [String(p._id), p._id]));
      await players.bulkWrite(updates.map(u => ({ updateOne: { filter: { _id: byId.get(u.id) }, update: { $addToSet: { eventIds: { $each: u.add } } } } })));
    }
    const names = newDocs.map(d => d.nickname);
    if (names.length) {
      await db.collection('audit_logs').insertOne({
        adminName: 'Rendszer', action: 'LIGA',
        details: `Automatikus beemelés eseményekről (${league.category}): ${names.length} új játékos – ${names.slice(0, 15).join(', ')}${names.length > 15 ? ', …' : ''}`,
        date: now,
      });
    }
    return { added: names.length, names };
  } finally {
    await db.collection('leagues').updateOne({ _id: league._id }, { $set: { autoSyncedAt: new Date() }, $unset: { autoSyncLockUntil: '' } });
  }
}

// Minden automatikus beemelésre beállított liga szinkronja (napi feladat)
export async function syncAllLeagues(db) {
  const leagues = await db.collection('leagues').find({ 'autoStores.0': { $exists: true } }).toArray();
  let added = 0;
  for (const l of leagues) added += (await syncLeaguePlayers(db, l, { force: true })).added;
  return added;
}
