import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { logSystemError } from '@/lib/systemLog';
import { getTavernDb } from '@/lib/mongodb';
import { verifyAdmin } from '@/lib/auth';
import { canManageCategory, hasFeature, eventStore, STORE_NAMES } from '@/lib/permissions';
import { toObjectId } from '@/lib/preorderData';
import { PREORDER_GAMES } from '@/lib/preorders';
import { budapestDateTime, addDays } from '@/lib/eventDates';
import { DEFAULT_RULES, LEAGUE_NAME_MAX, SESSION_TITLE_MAX, sanitizeLeagueStores, sanitizePlayer, sanitizeSession, normalizeNickname, uniqueNickname, nicknameKey, riotIdKey, computeStandings, buildSnapshot, describePointChanges, hasManualPoints } from '@/lib/leagues';
import { parseTdf, sanitizeTdfRules, tdfPoints, defaultTdfNickname, isFullNameNickname, TDF_CATEGORY, TDF_MAX_BYTES } from '@/lib/tdf';
import { syncLeaguePlayers, leagueSeasonStart, playerKeys } from '@/lib/leagueSync';

export const dynamic = 'force-dynamic';

// Ligák kezelése az admin felületen. Játékonként egy liga; a szervező csak az általa kezelt játékok ligáit
// látja és szerkesztheti. A pontokat a szervező írja be alkalmanként, a játékosok viszont a liga boltjainak
// eseményeiről automatikusan bekerülnek (lib/leagueSync.js), a Pokémon ligában a pontok TOM fájlból is számolhatók
// (UPLOAD_TDF, lib/tdf.js). A nyilvános ranglista csak a PUBLISH művelettel frissül.
// A pontok minden változása naplózódik (LIGA PONTOK, LIGA TDF); a liga naplóját a külön „Liga napló” jog mutatja.

async function addLog(db, adminName, action, details) {
  await db.collection('audit_logs').insertOne({ adminName: adminName || 'Rendszer', action, details, date: new Date() });
}
const storeList = (stores) => (stores.length ? stores.map(s => STORE_NAMES[s] || s).join(', ') : 'kikapcsolva');

const leagueOut = (l) => ({
  id: String(l._id), category: l.category, name: l.name, rules: { ...DEFAULT_RULES, ...(l.rules || {}) },
  createdAt: l.createdAt, createdBy: l.createdBy || '',
  // Automatikus beemelés: a kiválasztott boltok (null = még nincs beállítva), a szezon kezdete és a kizárt (törölt) játékosok száma
  autoStores: Array.isArray(l.autoStores) ? l.autoStores : null,
  seasonStart: leagueSeasonStart(l),
  ignoredCount: (l.ignoredPlayers || []).length,
  published: l.published ? { at: l.published.at, by: l.published.by || '', rows: l.published.rows || [] } : null,
});
const playerOut = (p) => ({ id: String(p._id), leagueId: p.leagueId, fullName: p.fullName || '', nickname: p.nickname, email: p.email || '', riotId: p.riotId || null, popId: p.popId || null, birthDate: p.birthDate || null, source: p.source || 'manual', eventIds: p.eventIds || [], createdAt: p.createdAt });
const sessionOut = (s) => ({ id: String(s._id), leagueId: s.leagueId, date: s.date, title: s.title || '', tournamentId: s.tournamentId || null, tdf: s.tdf || null, results: s.results || [], updatedAt: s.updatedAt });

const LOG_LIMIT = 300;
// Egy liga naplója: minden LIGA műveletnél a részletek tartalmazzák a játékot zárójelben, pl. "(Pokémon TCG)"
const leagueLogFilter = (category) => ({ action: { $regex: '^LIGA' }, details: { $regex: `\\(${category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)` } });
async function leagueLogs(db, leagues) {
  const lists = await Promise.all(leagues.map(async (l) => {
    const rows = await db.collection('audit_logs').find(leagueLogFilter(l.category)).sort({ date: -1 }).limit(LOG_LIMIT).toArray();
    return rows.map(r => ({ id: String(r._id), leagueId: String(l._id), date: r.date, adminName: r.adminName || '', action: r.action || '', details: r.details || '' }));
  }));
  return lists.flat();
}

// Az alkalomhoz választható események: a liga játékának eseményei (a beállított boltokban) a szezon kezdetétől holnapig
async function sessionEvents(db, leagues) {
  if (!leagues.length) return [];
  const until = `${addDays(budapestDateTime(Date.now()).slice(0, 10), 1)}T23:59`;
  const events = await db.collection('tournaments')
    .find({ category: { $in: leagues.map(l => l.category) }, date: { $gte: leagues.map(leagueSeasonStart).sort()[0], $lte: until } }, { projection: { name: 1, date: 1, store: 1, category: 1 } })
    .toArray();
  return events
    .map(e => ({ e, league: leagues.find(l => l.category === e.category) }))
    .filter(({ e, league }) => league && String(e.date) >= leagueSeasonStart(league) && (!league.autoStores?.length || league.autoStores.includes(eventStore(e))))
    .sort((a, b) => String(b.e.date).localeCompare(String(a.e.date)))
    .map(({ e, league }) => ({ id: String(e._id), leagueId: String(league._id), name: e.name, date: e.date, store: eventStore(e) }));
}

export async function GET() {
  try {
    const session = await verifyAdmin();
    if (!session) return NextResponse.json({ error: 'Jogosulatlan hozzáférés' }, { status: 401 });
    if (!hasFeature(session, 'leagues')) return NextResponse.json({ error: 'Nincs jogosultságod a ligákhoz. A tulajdonos adhat hozzáférést.' }, { status: 403 });
    const db = await getTavernDb();
    const leagues = (await db.collection('leagues').find({}).toArray()).filter(l => canManageCategory(session, l.category));
    // Új jelentkezők beemelése a ligák eseményeiről (ligánként legfeljebb fél percenként)
    await Promise.all(leagues.map(l => syncLeaguePlayers(db, l).catch(err => logSystemError('league sync', err))));
    const ids = leagues.map(l => String(l._id));
    const [players, sessions, seasons] = ids.length ? await Promise.all([
      db.collection('league_players').find({ leagueId: { $in: ids } }).sort({ nickname: 1 }).toArray(),
      db.collection('league_sessions').find({ leagueId: { $in: ids } }).sort({ date: -1, createdAt: -1 }).toArray(),
      db.collection('league_seasons').find({ leagueId: { $in: ids } }).sort({ closedAt: -1 }).toArray(),
    ]) : [[], [], []];
    return NextResponse.json({
      leagues: leagues.map(leagueOut),
      players: players.map(playerOut),
      sessions: sessions.map(sessionOut),
      seasons: seasons.map(s => ({ id: String(s._id), leagueId: s.leagueId, name: s.name, closedAt: s.closedAt, closedBy: s.closedBy || '', players: (s.rows || []).length, winners: (s.rows || []).filter(r => r.rank === 1).map(r => r.nickname) })),
      games: PREORDER_GAMES.filter(g => canManageCategory(session, g)),
      events: await sessionEvents(db, leagues),
      // A liga naplóját csak a külön joggal rendelkezők kapják meg
      canViewLog: hasFeature(session, 'leagueLog'),
      logs: hasFeature(session, 'leagueLog') ? await leagueLogs(db, leagues) : [],
    });
  } catch (error) {
    console.error('admin-leagues GET error:', error);
    await logSystemError('admin-leagues GET', error);
    return NextResponse.json({ error: 'Adatbázis hiba' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await verifyAdmin();
    if (!session) return NextResponse.json({ error: 'Nincs jogosultságod a művelethez!' }, { status: 401 });
    if (!hasFeature(session, 'leagues')) return NextResponse.json({ error: 'Nincs jogosultságod a ligákhoz. A tulajdonos adhat hozzáférést.' }, { status: 403 });
    const body = await request.json().catch(() => null);
    const { actionType, payload } = body || {};
    if (!payload || typeof payload !== 'object') return NextResponse.json({ error: 'Hiányzó adatok.' }, { status: 400 });

    const db = await getTavernDb();
    const leagues = db.collection('leagues');
    const players = db.collection('league_players');
    const sessions = db.collection('league_sessions');
    const bad = (error, status = 400, extra = {}) => NextResponse.json({ error, ...extra }, { status });
    const noPermission = () => bad('Ennek a játéknak a ligáját nem kezelheted.', 403);

    // A liga betöltése jogosultság-ellenőrzéssel
    const loadLeague = async (id) => {
      const oid = toObjectId(id);
      const league = oid ? await leagues.findOne({ _id: oid }) : null;
      if (!league) return { res: bad('A liga nem található.', 404) };
      if (!canManageCategory(session, league.category)) return { res: noPermission() };
      return { league };
    };

    if (actionType === 'CREATE_LEAGUE') {
      const category = String(payload.category || '');
      if (!PREORDER_GAMES.includes(category)) return bad('Válassz játékot.');
      if (!canManageCategory(session, category)) return noPermission();
      const name = String(payload.name ?? '').trim().replace(/\s+/g, ' ');
      if (!name || name.length > LEAGUE_NAME_MAX) return bad(`A liga neve kötelező (legfeljebb ${LEAGUE_NAME_MAX} karakter).`);
      const autoStores = sanitizeLeagueStores(payload.autoStores) || [];
      if (await leagues.findOne({ category })) return bad('Ennek a játéknak már van ligája.');
      try {
        const doc = { category, name, rules: DEFAULT_RULES, autoStores, createdAt: new Date(), createdBy: session.username };
        const inserted = await leagues.insertOne(doc);
        await addLog(db, session.username, 'LIGA', `Új liga: ${name} (${category}), automatikus beemelés: ${storeList(autoStores)}`);
        const { added } = await syncLeaguePlayers(db, { ...doc, _id: inserted.insertedId }, { force: true });
        return NextResponse.json({ success: true, id: String(inserted.insertedId), added });
      } catch (e) {
        if (e?.code === 11000) return bad('Ennek a játéknak már van ligája.');
        throw e;
      }
    }

    if (actionType === 'UPDATE_LEAGUE') {
      const { league, res } = await loadLeague(payload.id);
      if (res) return res;
      const name = String(payload.name ?? '').trim().replace(/\s+/g, ' ');
      if (!name || name.length > LEAGUE_NAME_MAX) return bad(`A liga neve kötelező (legfeljebb ${LEAGUE_NAME_MAX} karakter).`);
      const autoStores = sanitizeLeagueStores(payload.autoStores) || [];
      await leagues.updateOne({ _id: league._id }, { $set: { name, autoStores, updatedAt: new Date() } });
      await addLog(db, session.username, 'LIGA', `Beállítások módosítva: ${name} (${league.category}), automatikus beemelés: ${storeList(autoStores)}`);
      const { added } = await syncLeaguePlayers(db, { ...league, name, autoStores }, { force: true });
      return NextResponse.json({ success: true, added });
    }

    // A törölt (kizárt) játékosok visszaengedése: a következő szinkronnál újra bekerülhetnek az eseményekről
    if (actionType === 'CLEAR_IGNORED') {
      const { league, res } = await loadLeague(payload.leagueId);
      if (res) return res;
      await leagues.updateOne({ _id: league._id }, { $unset: { ignoredPlayers: '' } });
      await addLog(db, session.username, 'LIGA', `Törölt játékosok visszaengedve (${league.category}): ${(league.ignoredPlayers || []).length} azonosító`);
      const { added } = await syncLeaguePlayers(db, { ...league, ignoredPlayers: [] }, { force: true });
      return NextResponse.json({ success: true, added });
    }

    if (actionType === 'DELETE_LEAGUE') {
      const { league, res } = await loadLeague(payload.id);
      if (res) return res;
      const id = String(league._id);
      await Promise.all([players.deleteMany({ leagueId: id }), sessions.deleteMany({ leagueId: id }), db.collection('league_seasons').deleteMany({ leagueId: id })]);
      await leagues.deleteOne({ _id: league._id });
      await addLog(db, session.username, 'LIGA TÖRLÉSE', `${league.name} (${league.category}) a játékosokkal, alkalmakkal és korábbi szezonokkal együtt`);
      return NextResponse.json({ success: true });
    }

    if (actionType === 'SAVE_PLAYER') {
      const { league, res } = await loadLeague(payload.leagueId);
      if (res) return res;
      const leagueId = String(league._id);
      const existingId = payload.id ? toObjectId(payload.id) : null;
      if (payload.id && !existingId) return bad('A játékos nem található.', 404);
      // Az eseményekről vagy TDF fájlból beemelt játékosnál a teljes név és az e-mail nem kötelező
      const current = existingId ? await players.findOne({ _id: existingId, leagueId }, { projection: { source: 1 } }) : null;
      const { player, error, field } = sanitizePlayer(payload, { relaxed: ['event', 'rgn', 'tdf'].includes(current?.source) });
      if (error) return bad(error, 400, { field });
      const others = await players.find({ leagueId, ...(existingId ? { _id: { $ne: existingId } } : {}) }, { projection: { nickname: 1, email: 1, riotId: 1, popId: 1 } }).toArray();
      if (player.email && others.some(o => o.email === player.email)) return bad('Ezzel az e-mail címmel már van játékos ebben a ligában.', 400, { field: 'email' });
      if (player.riotId && others.some(o => o.riotId && riotIdKey(o.riotId) === riotIdKey(player.riotId))) return bad('Ezzel a Riot-azonosítóval már van játékos ebben a ligában.', 400, { field: 'riotId' });
      if (player.popId && others.some(o => o.popId === player.popId)) return bad('Ezzel a POP-azonosítóval már van játékos ebben a ligában.', 400, { field: 'popId' });
      if (others.some(o => nicknameKey(o.nickname) === nicknameKey(player.nickname))) return bad('Ez a becenév már foglalt ebben a ligában.', 400, { field: 'nickname' });
      if (existingId) {
        const upd = await players.updateOne({ _id: existingId, leagueId }, { $set: { ...player, updatedAt: new Date() } });
        if (upd.matchedCount === 0) return bad('A játékos nem található.', 404);
        await addLog(db, session.username, 'LIGA', `Játékos módosítva (${league.category}): ${player.nickname} – ${player.fullName || player.riotId}`);
        return NextResponse.json({ success: true, id: String(existingId) });
      }
      const inserted = await players.insertOne({ ...player, leagueId, createdAt: new Date(), createdBy: session.username });
      await addLog(db, session.username, 'LIGA', `Új játékos (${league.category}): ${player.nickname} – ${player.fullName || player.riotId}`);
      return NextResponse.json({ success: true, id: String(inserted.insertedId) });
    }

    if (actionType === 'DELETE_PLAYER') {
      const oid = toObjectId(payload.id);
      const player = oid ? await players.findOne({ _id: oid }) : null;
      if (!player) return bad('A játékos nem található.', 404);
      const { league, res } = await loadLeague(player.leagueId);
      if (res) return res;
      // Az alkalmak eredményeiből is kivesszük, és az automatikus beemelés sem hozza vissza (a beállításokban visszaengedhető)
      await sessions.updateMany({ leagueId: player.leagueId }, { $pull: { results: { playerId: String(player._id) } } });
      await players.deleteOne({ _id: player._id });
      await leagues.updateOne({ _id: league._id }, { $addToSet: { ignoredPlayers: { $each: playerKeys(player) } } });
      await addLog(db, session.username, 'LIGA', `Játékos törölve (${league.category}): ${player.nickname}${player.fullName ? ` – ${player.fullName}` : ''}`);
      return NextResponse.json({ success: true });
    }

    if (actionType === 'SAVE_SESSION') {
      const { league, res } = await loadLeague(payload.leagueId);
      if (res) return res;
      const leagueId = String(league._id);
      const nickById = new Map((await players.find({ leagueId }, { projection: { nickname: 1 } }).toArray()).map(p => [String(p._id), p.nickname]));
      const validIds = new Set(nickById.keys());
      const nicknameOf = (id) => nickById.get(String(id)) || 'törölt játékos';
      const { session: data, error } = sanitizeSession(payload, validIds);
      if (error) return bad(error);
      // Az alkalom egy eseményhez köthető (nem kötelező): csak a liga játékának eseménye lehet
      let tournamentId = null;
      if (payload.tournamentId) {
        const evOid = toObjectId(payload.tournamentId);
        const event = evOid ? await db.collection('tournaments').findOne({ _id: evOid }, { projection: { category: 1 } }) : null;
        if (!event || event.category !== league.category) return bad('A kiválasztott esemény nem ehhez a játékhoz tartozik.');
        tournamentId = String(event._id);
      }
      const now = new Date();
      const rules = { ...DEFAULT_RULES, ...(league.rules || {}) };
      const total = data.results.reduce((s, r) => s + r.points, 0);
      const summary = `${data.date}${data.title ? ` ${data.title}` : ''}, ${data.results.length} játékos, ${total} pont`;
      if (payload.id) {
        const oid = toObjectId(payload.id);
        const existing = oid ? await sessions.findOne({ _id: oid, leagueId }) : null;
        if (!existing) return bad('Az alkalom nem található.', 404);
        // A TDF fájlból jött meccsadatok a pont átírása után is megmaradnak (a kapott pont már a kézzel beírt)
        const before = new Map((existing.results || []).map(r => [String(r.playerId), r]));
        const results = data.results.map(r => {
          const old = before.get(r.playerId);
          if (!old || !hasManualPoints(old) || !Number.isInteger(old.wins)) return r;
          const { wins, draws, losses, byes, place, division, popId } = old;
          return { ...r, wins, draws, losses, byes, place, division, popId };
        });
        await sessions.updateOne({ _id: oid, leagueId }, { $set: { ...data, results, tournamentId, updatedAt: now, updatedBy: session.username } });
        const changes = describePointChanges(existing.results, results, nicknameOf, rules);
        await addLog(db, session.username, 'LIGA PONTOK', `Alkalom módosítva (${league.category}): ${summary}. ${changes ? `Változások: ${changes}` : 'A pontok nem változtak.'}`);
        return NextResponse.json({ success: true, id: payload.id });
      }
      const inserted = await sessions.insertOne({ ...data, tournamentId, leagueId, createdAt: now, updatedAt: now, createdBy: session.username });
      await addLog(db, session.username, 'LIGA PONTOK', `Új alkalom (${league.category}): ${summary}. Pontok: ${describePointChanges([], data.results, nicknameOf, rules) || 'nincs'}`);
      return NextResponse.json({ success: true, id: String(inserted.insertedId) });
    }

    // TOM (.tdf) fájl feldolgozása: a pontozást feltöltésenként adják meg, a pontokat a szerver számolja a fájlból.
    // assignments: játékosonként (POP-azonosító) a liga meglévő játékosa (playerId), vagy új játékos a megadott becenévvel.
    if (actionType === 'UPLOAD_TDF') {
      const { league, res } = await loadLeague(payload.leagueId);
      if (res) return res;
      if (league.category !== TDF_CATEGORY) return bad(`TDF fájlt csak a(z) ${TDF_CATEGORY} ligához lehet feltölteni.`);
      const leagueId = String(league._id);
      const rules = sanitizeTdfRules(payload.rules);
      if (!rules) return bad('Add meg, hány pont jár a megjelenésért, a győzelemért és a döntetlenért (0 is lehet).');
      if (typeof payload.xml !== 'string' || Buffer.byteLength(payload.xml) > TDF_MAX_BYTES) return bad('A fájl hiányzik, vagy túl nagy.');
      const parsed = parseTdf(payload.xml);
      if (parsed.error) return bad(parsed.error);
      const { tournament } = parsed;
      const duplicate = await sessions.findOne({ leagueId, 'tdf.id': tournament.id }, { projection: { date: 1 } });
      if (duplicate) return bad(`Ezt a versenyt (${tournament.id}) már feltöltötték ${duplicate.date} dátummal. Ha újra fel akarod tölteni, előbb töröld a korábbi alkalmat.`, 409);

      const assignments = new Map((Array.isArray(payload.assignments) ? payload.assignments : []).map(a => [String(a?.popId), a]));
      const existing = await players.find({ leagueId }, { projection: { nickname: 1, fullName: 1, popId: 1 } }).toArray();
      const byId = new Map(existing.map(p => [String(p._id), p]));
      const taken = new Set(existing.map(p => nicknameKey(p.nickname)));
      const usedIds = new Set();
      const links = [];
      const created = [];
      const now = new Date();
      const entries = [];
      for (const p of parsed.players) {
        const choice = assignments.get(p.popId);
        const playerId = choice?.playerId ? String(choice.playerId) : null;
        if (playerId) {
          const target = byId.get(playerId);
          if (!target) return bad(`${p.fullName}: a kiválasztott ligajátékos nem található.`);
          if (target.popId && target.popId !== p.popId) return bad(`${target.nickname} egy másik POP-azonosítóhoz tartozik, ${p.fullName} nem párosítható vele.`);
          if (usedIds.has(playerId)) return bad(`${target.nickname} két játékoshoz is ki van választva.`);
          usedIds.add(playerId);
          // A ranglistára ne kerüljön ki a teljes név: ha az volt a beceneve, rövidítjük
          let nickname = target.nickname;
          if (isFullNameNickname(nickname, p)) {
            taken.delete(nicknameKey(nickname));
            nickname = uniqueNickname(defaultTdfNickname(p), taken);
            taken.add(nicknameKey(nickname));
          }
          links.push({ updateOne: { filter: { _id: target._id }, update: { $set: { popId: p.popId, nickname, ...(p.birthDate ? { birthDate: p.birthDate } : {}), ...(target.fullName ? {} : { fullName: p.fullName }) } } } });
          entries.push({ p, playerId, nickname });
          continue;
        }
        const nickname = normalizeNickname(choice?.nickname);
        if (!nickname) return bad(`${p.fullName}: a becenév 2-24 karakter lehet (betű, szám, szóköz, pont, aláhúzás, kötőjel).`);
        if (taken.has(nicknameKey(nickname))) return bad(`A(z) „${nickname}” becenév már foglalt ebben a ligában.`);
        // A POP-azonosító egyedi: ha már van ilyen játékos, azt kell kiválasztani, különben kettészakadnának a pontjai
        const samePop = existing.find(o => o.popId === p.popId);
        if (samePop) return bad(`${p.fullName} már szerepel a ligában ${samePop.nickname} néven, válaszd ki őt.`);
        taken.add(nicknameKey(nickname));
        const _id = new ObjectId();
        created.push({ _id, fullName: p.fullName, nickname, email: null, riotId: null, popId: p.popId, birthDate: p.birthDate, source: 'tdf', eventIds: [], leagueId, createdAt: now, createdBy: session.username });
        entries.push({ p, playerId: String(_id), nickname });
      }

      if (created.length) await players.insertMany(created);
      if (links.length) await players.bulkWrite(links);
      const results = entries.map(({ p, playerId }) => ({
        playerId, attended: true, points: tdfPoints(p, rules),
        wins: p.wins, draws: p.draws, losses: p.losses, byes: p.byes, place: p.place, division: p.division, popId: p.popId,
      }));
      const title = tournament.name.slice(0, SESSION_TITLE_MAX);
      const inserted = await sessions.insertOne({
        date: tournament.date, title, results, tournamentId: null, leagueId, createdAt: now, updatedAt: now, createdBy: session.username,
        tdf: { id: tournament.id, name: tournament.name, city: tournament.city, rules, rounds: tournament.rounds, topCutRounds: tournament.topCutRounds, fileName: String(payload.fileName || '').slice(0, 120) },
      });
      const nicks = new Map(entries.map(e => [e.playerId, e.nickname]));
      await addLog(db, session.username, 'LIGA TDF', `TDF feltöltve (${league.category}): ${tournament.date} ${tournament.name} (${tournament.id}), pontozás: megjelenés ${rules.attendance}, győzelem ${rules.win}, döntetlen ${rules.draw}. ${results.length} játékos, ebből ${created.length} új. Pontok: ${describePointChanges([], results, id => nicks.get(id))}`);
      return NextResponse.json({ success: true, id: String(inserted.insertedId), added: created.length });
    }

    if (actionType === 'DELETE_SESSION') {
      const oid = toObjectId(payload.id);
      const s = oid ? await sessions.findOne({ _id: oid }) : null;
      if (!s) return bad('Az alkalom nem található.', 404);
      const { league, res } = await loadLeague(s.leagueId);
      if (res) return res;
      const nickById = new Map((await players.find({ leagueId: s.leagueId }, { projection: { nickname: 1 } }).toArray()).map(p => [String(p._id), p.nickname]));
      await sessions.deleteOne({ _id: s._id });
      await addLog(db, session.username, 'LIGA PONTOK', `Alkalom törölve (${league.category}): ${s.date}${s.title ? ` ${s.title}` : ''}. Törölt pontok: ${describePointChanges(s.results, [], id => nickById.get(String(id)) || 'törölt játékos', { ...DEFAULT_RULES, ...(league.rules || {}) }) || 'nincs'}`);
      return NextResponse.json({ success: true });
    }

    // Publikálás: az állást a szerver számolja újra a piszkozatból, és elmenti a nyilvános pillanatképet
    // a legutóbbi publikálás óta kapott pontokkal együtt
    if (actionType === 'PUBLISH') {
      const { league, res } = await loadLeague(payload.leagueId);
      if (res) return res;
      const leagueId = String(league._id);
      const [pl, ss] = await Promise.all([
        players.find({ leagueId }).toArray(),
        sessions.find({ leagueId }).toArray(),
      ]);
      const standings = computeStandings({ ...DEFAULT_RULES, ...(league.rules || {}) }, pl.map(p => ({ id: String(p._id), nickname: p.nickname })), ss);
      const rows = buildSnapshot(standings, league.published?.rows);
      const now = new Date();
      // Feltételes mentés: ha közben valaki más publikált, nem írjuk felül (különben rossz lenne a "+pont")
      const filter = league.published?.at ? { _id: league._id, 'published.at': league.published.at } : { _id: league._id, published: { $exists: false } };
      const upd = await leagues.updateOne(filter, { $set: { published: { at: now, by: session.username, rows } } });
      if (upd.matchedCount === 0) return bad('Közben valaki más publikálta a ranglistát. Frissítsd az oldalt, nézd meg az előnézetet, és publikáld újra.', 409);
      await addLog(db, session.username, 'LIGA PUBLIKÁLÁS', `${league.name} (${league.category}): ${rows.length} játékos`);
      return NextResponse.json({ success: true, publishedAt: now, rows });
    }

    // Szezon lezárása: a jelenlegi (piszkozat) állás végeredményként archiválódik (csak becenevek), az alkalmak törlődnek,
    // a játékosok kérésre megmaradnak, és új néven, nulláról indul a következő szezon (még publikálatlan ranglistával)
    if (actionType === 'CLOSE_SEASON') {
      const { league, res } = await loadLeague(payload.leagueId);
      if (res) return res;
      const newName = String(payload.newName ?? '').trim().replace(/\s+/g, ' ');
      if (!newName || newName.length > LEAGUE_NAME_MAX) return bad(`Add meg az új szezon nevét (legfeljebb ${LEAGUE_NAME_MAX} karakter).`);
      if (newName === league.name) return bad('Az új szezon neve legyen más, mint a mostanié (pl. évszak vagy év).');
      const keepPlayers = payload.keepPlayers !== false;
      const leagueId = String(league._id);
      const [pl, ss] = await Promise.all([players.find({ leagueId }).toArray(), sessions.find({ leagueId }).toArray()]);
      if (ss.length === 0) return bad('Ebben a szezonban még nincs rögzített alkalom, nincs mit lezárni.');
      const standings = computeStandings({ ...DEFAULT_RULES, ...(league.rules || {}) }, pl.map(p => ({ id: String(p._id), nickname: p.nickname })), ss);
      const rows = buildSnapshot(standings, null).map(r => ({ ...r, delta: 0 }));
      const now = new Date();
      // Feltételes váltás: ha közben valaki más már lezárta, ne archiváljunk kétszer
      const switched = await leagues.updateOne({ _id: league._id, name: league.name }, { $set: { name: newName, seasonStartedAt: now }, $unset: { published: '' } });
      if (switched.matchedCount === 0) return bad('Közben valaki más módosította a ligát. Frissítsd az oldalt.', 409);
      await db.collection('league_seasons').insertOne({ leagueId, category: league.category, name: league.name, rules: league.rules, closedAt: now, closedBy: session.username, sessionCount: ss.length, rows });
      await sessions.deleteMany({ leagueId });
      if (!keepPlayers) await players.deleteMany({ leagueId });
      await addLog(db, session.username, 'LIGA SZEZON', `${league.name} (${league.category}) lezárva, ${rows.length} játékos, ${ss.length} alkalom. Új szezon: ${newName}${keepPlayers ? ' (játékosok megtartva)' : ' (játékosok törölve)'}`);
      return NextResponse.json({ success: true });
    }

    if (actionType === 'DELETE_SEASON') {
      const oid = toObjectId(payload.id);
      const season = oid ? await db.collection('league_seasons').findOne({ _id: oid }) : null;
      if (!season) return bad('A szezon nem található.', 404);
      const { res } = await loadLeague(season.leagueId);
      if (res) return res;
      await db.collection('league_seasons').deleteOne({ _id: season._id });
      await addLog(db, session.username, 'LIGA SZEZON', `Archív szezon törölve: ${season.name} (${season.category})`);
      return NextResponse.json({ success: true });
    }

    return bad('Ismeretlen művelet.');
  } catch (error) {
    console.error('admin-leagues POST error:', error);
    await logSystemError('admin-leagues POST', error);
    return NextResponse.json({ error: 'A művelet nem sikerült.' }, { status: 500 });
  }
}
