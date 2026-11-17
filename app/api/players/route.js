import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { logSystemError } from '@/lib/systemLog';
import { getTavernDb } from '@/lib/mongodb';
import { verifyAdmin } from '@/lib/auth';
import { canManageCategory, seesPersonalData } from '@/lib/permissions';
import { GAME_CONFIG } from '@/lib/gameConfig';
import { sanitizePlayerInput, findMatch, normName, isRiftbound, isPokemon } from '@/lib/playerBase';
import { syncPlayerBase, PLAYERS } from '@/lib/playerBaseSync';

export const dynamic = 'force-dynamic';

// Játékos bázis játékonként (lib/playerBase.js). Csak az látja és szerkeszti, aki az adott játékot kezelheti.
// Az e-mail cím csak 2. szinten (személyes adatok joga) jön ki és írható. GET ?jatek=<játék>: a lista (előtte frissít
// a jelentkezésekből). POST: SAVE (új / szerkesztés), DELETE.
const bad = (error, status = 400, extra = {}) => NextResponse.json({ error, ...extra }, { status });
const oid = (id) => (ObjectId.isValid(String(id || '')) && String(id).length === 24 ? new ObjectId(String(id)) : null);
const GAMES = Object.keys(GAME_CONFIG);

async function addLog(db, adminName, action, details) {
  await db.collection('audit_logs').insertOne({ adminName: adminName || 'Rendszer', action, details, date: new Date() });
}

const out = (p, full) => ({
  id: String(p._id), category: p.category, username: p.username || '', name: p.name || '',
  ...(full ? { email: p.email || '' } : { hasEmail: !!p.email }),
  ...(isPokemon(p.category) && { playerId: p.playerId || '' }),
  ...(isRiftbound(p.category) && { summoner: p.summoner || '' }),
  note: p.note || '', events: p.events || 0, firstSeen: p.firstSeen || null, lastSeen: p.lastSeen || null, lastEvent: p.lastEvent || '',
  source: p.source || 'auto', updatedBy: p.updatedBy || '',
});

export async function GET(request) {
  try {
    const session = await verifyAdmin();
    if (!session) return bad('Jogosulatlan hozzáférés', 401);
    const games = GAMES.filter(g => canManageCategory(session, g));
    if (!games.length) return bad('Nincs olyan játék, amelyet kezelhetsz.', 403);
    const db = await getTavernDb();
    await syncPlayerBase(db).catch(err => console.error('játékos bázis frissítése:', err));

    const wanted = new URL(request.url).searchParams.get('jatek');
    const category = games.includes(wanted) ? wanted : games[0];
    const counts = Object.fromEntries((await db.collection(PLAYERS).aggregate([{ $match: { category: { $in: games } } }, { $group: { _id: '$category', n: { $sum: 1 } } }]).toArray()).map(r => [r._id, r.n]));
    const full = seesPersonalData(session);
    const players = await db.collection(PLAYERS).find({ category }).sort({ lastSeen: -1, createdAt: -1 }).limit(5000).toArray();
    return NextResponse.json({ category, games: games.map(g => ({ category: g, count: counts[g] || 0 })), personalData: full, players: players.map(p => out(p, full)) });
  } catch (error) {
    console.error('players GET error:', error);
    await logSystemError('players GET', error);
    return bad('Adatbázis hiba', 500);
  }
}

export async function POST(request) {
  try {
    const session = await verifyAdmin();
    if (!session) return bad('Nincs jogosultságod a művelethez!', 401);
    const body = await request.json().catch(() => null);
    const { actionType, payload } = body || {};
    if (!payload || typeof payload !== 'object') return bad('Hiányzó adatok.');
    const db = await getTavernDb();
    const col = db.collection(PLAYERS);
    const full = seesPersonalData(session);

    if (actionType === 'SAVE') {
      const id = payload.id ? oid(payload.id) : null;
      const existing = id ? await col.findOne({ _id: id }) : null;
      if (payload.id && !existing) return bad('A játékos nem található.', 404);
      const category = existing ? existing.category : String(payload.category || '');
      if (!GAMES.includes(category) || !canManageCategory(session, category)) return bad('Ennek a játéknak a játékosait nem kezelheted.', 403);
      const { player, error, field } = sanitizePlayerInput(category, payload, { canEmail: full });
      if (error) return bad(error, 400, { field });

      // Ne legyen két azonos játékos (e-mail, név, idézőnév szerint)
      const others = (await col.find({ category, ...(existing && { _id: { $ne: existing._id } }) }).toArray());
      const dup = findMatch(others, { ...player, email: player.email ?? existing?.email ?? '' }, category);
      if (dup) return bad(`Már van ilyen játékos a listában: ${dup.summoner || dup.username || dup.name}.`, 400, { field: isRiftbound(category) ? 'summoner' : 'username' });

      const now = new Date();
      const aliases = [...new Set([...(existing?.aliases || []), ...[player.summoner, player.username, player.name].map(normName).filter(Boolean)])].slice(0, 20);
      if (existing) {
        await col.updateOne({ _id: existing._id }, { $set: { ...player, aliases, updatedAt: now, updatedBy: session.username } });
      } else {
        await col.insertOne({ category, ...player, aliases, events: 0, source: 'manual', createdAt: now, updatedAt: now, updatedBy: session.username });
      }
      await addLog(db, session.username, 'JÁTÉKOS', `${category}: ${player.summoner || player.username || player.name} ${existing ? 'szerkesztve' : 'felvéve'}`);
      return NextResponse.json({ success: true });
    }

    if (actionType === 'DELETE') {
      const existing = oid(payload.id) ? await col.findOne({ _id: oid(payload.id) }) : null;
      if (!existing) return bad('A játékos nem található.', 404);
      if (!canManageCategory(session, existing.category)) return bad('Ennek a játéknak a játékosait nem kezelheted.', 403);
      await col.deleteOne({ _id: existing._id });
      await addLog(db, session.username, 'JÁTÉKOS', `${existing.category}: ${existing.summoner || existing.username || existing.name} törölve`);
      return NextResponse.json({ success: true });
    }

    return bad('Ismeretlen művelet.');
  } catch (error) {
    console.error('players POST error:', error);
    await logSystemError('players POST', error);
    return bad('Szerverhiba', 500);
  }
}
