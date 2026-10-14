import { NextResponse } from 'next/server';
import { getTavernDb } from '@/lib/mongodb';
import { verifyAdmin } from '@/lib/auth';
import { canManageCategory, hasFeature } from '@/lib/permissions';
import { toObjectId } from '@/lib/preorderData';
import { PREORDER_GAMES } from '@/lib/preorders';
import { DEFAULT_RULES, LEAGUE_NAME_MAX, sanitizeRules, sanitizePlayer, sanitizeSession, nicknameKey, computeStandings, buildSnapshot } from '@/lib/leagues';

export const dynamic = 'force-dynamic';

// Ligák kezelése az admin felületen. Játékonként egy liga; a szervező csak az általa kezelt játékok ligáit
// látja és szerkesztheti. A nyilvános ranglista csak a PUBLISH művelettel frissül.

async function addLog(db, adminName, action, details) {
  await db.collection('audit_logs').insertOne({ adminName: adminName || 'Rendszer', action, details, date: new Date() });
}

const leagueOut = (l) => ({
  id: String(l._id), category: l.category, name: l.name, rules: { ...DEFAULT_RULES, ...(l.rules || {}) },
  createdAt: l.createdAt, createdBy: l.createdBy || '',
  published: l.published ? { at: l.published.at, by: l.published.by || '', rows: l.published.rows || [] } : null,
});
const playerOut = (p) => ({ id: String(p._id), leagueId: p.leagueId, fullName: p.fullName, nickname: p.nickname, email: p.email, createdAt: p.createdAt });
const sessionOut = (s) => ({ id: String(s._id), leagueId: s.leagueId, date: s.date, title: s.title || '', results: s.results || [], updatedAt: s.updatedAt });

export async function GET() {
  try {
    const session = await verifyAdmin();
    if (!session) return NextResponse.json({ error: 'Jogosulatlan hozzáférés' }, { status: 401 });
    if (!hasFeature(session, 'leagues')) return NextResponse.json({ error: 'Nincs jogosultságod a ligákhoz. A tulajdonos adhat hozzáférést.' }, { status: 403 });
    const db = await getTavernDb();
    const leagues = (await db.collection('leagues').find({}).toArray()).filter(l => canManageCategory(session, l.category));
    const ids = leagues.map(l => String(l._id));
    const [players, sessions] = ids.length ? await Promise.all([
      db.collection('league_players').find({ leagueId: { $in: ids } }).sort({ nickname: 1 }).toArray(),
      db.collection('league_sessions').find({ leagueId: { $in: ids } }).sort({ date: -1, createdAt: -1 }).toArray(),
    ]) : [[], []];
    return NextResponse.json({
      leagues: leagues.map(leagueOut),
      players: players.map(playerOut),
      sessions: sessions.map(sessionOut),
      games: PREORDER_GAMES.filter(g => canManageCategory(session, g)),
    });
  } catch (error) {
    console.error('admin-leagues GET error:', error);
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
      const { rules, error } = sanitizeRules(payload.rules);
      if (error) return bad(error);
      if (await leagues.findOne({ category })) return bad('Ennek a játéknak már van ligája.');
      try {
        const inserted = await leagues.insertOne({ category, name, rules, createdAt: new Date(), createdBy: session.username });
        await addLog(db, session.username, 'LIGA', `Új liga: ${name} (${category})`);
        return NextResponse.json({ success: true, id: String(inserted.insertedId) });
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
      const { rules, error } = sanitizeRules(payload.rules);
      if (error) return bad(error);
      await leagues.updateOne({ _id: league._id }, { $set: { name, rules, updatedAt: new Date() } });
      await addLog(db, session.username, 'LIGA', `Beállítások módosítva: ${name} (${league.category})`);
      return NextResponse.json({ success: true });
    }

    if (actionType === 'DELETE_LEAGUE') {
      const { league, res } = await loadLeague(payload.id);
      if (res) return res;
      const id = String(league._id);
      await Promise.all([players.deleteMany({ leagueId: id }), sessions.deleteMany({ leagueId: id })]);
      await leagues.deleteOne({ _id: league._id });
      await addLog(db, session.username, 'LIGA TÖRLÉSE', `${league.name} (${league.category}) a játékosokkal és alkalmakkal együtt`);
      return NextResponse.json({ success: true });
    }

    if (actionType === 'SAVE_PLAYER') {
      const { league, res } = await loadLeague(payload.leagueId);
      if (res) return res;
      const { player, error, field } = sanitizePlayer(payload);
      if (error) return bad(error, 400, { field });
      const leagueId = String(league._id);
      const existingId = payload.id ? toObjectId(payload.id) : null;
      if (payload.id && !existingId) return bad('A játékos nem található.', 404);
      const others = await players.find({ leagueId, ...(existingId ? { _id: { $ne: existingId } } : {}) }, { projection: { nickname: 1, email: 1 } }).toArray();
      if (others.some(o => o.email === player.email)) return bad('Ezzel az e-mail címmel már van játékos ebben a ligában.', 400, { field: 'email' });
      if (others.some(o => nicknameKey(o.nickname) === nicknameKey(player.nickname))) return bad('Ez a becenév már foglalt ebben a ligában.', 400, { field: 'nickname' });
      if (existingId) {
        const upd = await players.updateOne({ _id: existingId, leagueId }, { $set: { ...player, updatedAt: new Date() } });
        if (upd.matchedCount === 0) return bad('A játékos nem található.', 404);
        await addLog(db, session.username, 'LIGA', `Játékos módosítva (${league.category}): ${player.nickname} – ${player.fullName}`);
        return NextResponse.json({ success: true, id: String(existingId) });
      }
      const inserted = await players.insertOne({ ...player, leagueId, createdAt: new Date(), createdBy: session.username });
      await addLog(db, session.username, 'LIGA', `Új játékos (${league.category}): ${player.nickname} – ${player.fullName}`);
      return NextResponse.json({ success: true, id: String(inserted.insertedId) });
    }

    if (actionType === 'DELETE_PLAYER') {
      const oid = toObjectId(payload.id);
      const player = oid ? await players.findOne({ _id: oid }) : null;
      if (!player) return bad('A játékos nem található.', 404);
      const { res } = await loadLeague(player.leagueId);
      if (res) return res;
      // Az alkalmak eredményeiből is kivesszük
      await sessions.updateMany({ leagueId: player.leagueId }, { $pull: { results: { playerId: String(player._id) } } });
      await players.deleteOne({ _id: player._id });
      await addLog(db, session.username, 'LIGA', `Játékos törölve: ${player.nickname} – ${player.fullName}`);
      return NextResponse.json({ success: true });
    }

    if (actionType === 'SAVE_SESSION') {
      const { league, res } = await loadLeague(payload.leagueId);
      if (res) return res;
      const leagueId = String(league._id);
      const validIds = new Set((await players.find({ leagueId }, { projection: { _id: 1 } }).toArray()).map(p => String(p._id)));
      const { session: data, error } = sanitizeSession(payload, validIds);
      if (error) return bad(error);
      const now = new Date();
      if (payload.id) {
        const oid = toObjectId(payload.id);
        const upd = oid ? await sessions.updateOne({ _id: oid, leagueId }, { $set: { ...data, updatedAt: now, updatedBy: session.username } }) : { matchedCount: 0 };
        if (upd.matchedCount === 0) return bad('Az alkalom nem található.', 404);
        await addLog(db, session.username, 'LIGA', `Alkalom módosítva (${league.category}): ${data.date}${data.title ? ` ${data.title}` : ''}, ${data.results.filter(r => r.attended).length} megjelent`);
        return NextResponse.json({ success: true, id: payload.id });
      }
      const inserted = await sessions.insertOne({ ...data, leagueId, createdAt: now, updatedAt: now, createdBy: session.username });
      await addLog(db, session.username, 'LIGA', `Új alkalom (${league.category}): ${data.date}${data.title ? ` ${data.title}` : ''}, ${data.results.filter(r => r.attended).length} megjelent`);
      return NextResponse.json({ success: true, id: String(inserted.insertedId) });
    }

    if (actionType === 'DELETE_SESSION') {
      const oid = toObjectId(payload.id);
      const s = oid ? await sessions.findOne({ _id: oid }) : null;
      if (!s) return bad('Az alkalom nem található.', 404);
      const { league, res } = await loadLeague(s.leagueId);
      if (res) return res;
      await sessions.deleteOne({ _id: s._id });
      await addLog(db, session.username, 'LIGA', `Alkalom törölve (${league.category}): ${s.date}${s.title ? ` ${s.title}` : ''}`);
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

    return bad('Ismeretlen művelet.');
  } catch (error) {
    console.error('admin-leagues POST error:', error);
    return NextResponse.json({ error: 'A művelet nem sikerült.' }, { status: 500 });
  }
}
