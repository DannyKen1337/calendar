import { NextResponse } from 'next/server';
import { getTavernDb } from '@/lib/mongodb';
import { deleteOldAttendanceHistory } from '@/lib/attendanceHistory';
import { deleteExpiredPreorders, deleteInactiveLeaguePlayers, PREORDER_RETENTION_MONTHS, LEAGUE_PLAYER_RETENTION_MONTHS } from '@/lib/retention';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  
  // Szigorúbb feltétel, ami nem engedi át, ha hiányzik a környezeti változó
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Jogosulatlan hozzáférés' }, { status: 401 });
  }

  try {
    const db = await getTavernDb();
    
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    const allEvents = await db.collection('tournaments').find({}).toArray();
    const oldEventIds = allEvents
      .filter(evt => new Date(evt.date) < twoMonthsAgo)
      .map(evt => evt._id);

    if (oldEventIds.length > 0) {
      await db.collection('tournaments').deleteMany({ _id: { $in: oldEventIds } });
      const stringIds = oldEventIds.map(id => String(id));
      await db.collection('registrations').deleteMany({ tournamentId: { $in: stringIds } });
      
      await db.collection('audit_logs').insertOne({
        adminName: 'Vercel Automata',
        action: 'AUTOMATA TAKARÍTÁS',
        details: `${oldEventIds.length} db 2 hónapnál régebbi esemény törölve.`,
        date: new Date()
      });
    }

    await deleteOldAttendanceHistory(db);

    // Előrendelések és inaktív ligajátékosok személyes adatainak törlése
    const preorders = await deleteExpiredPreorders(db);
    if (preorders.products > 0) {
      await db.collection('audit_logs').insertOne({ adminName: 'Vercel Automata', action: 'AUTOMATA TAKARÍTÁS', details: `${preorders.products} db, ${PREORDER_RETENTION_MONTHS} hónapja lezárt előrendelési termék törölve ${preorders.preorders} jelentkezéssel (${preorders.names.join(', ')}).`, date: new Date() });
    }
    const players = await deleteInactiveLeaguePlayers(db);
    if (players > 0) {
      await db.collection('audit_logs').insertOne({ adminName: 'Vercel Automata', action: 'AUTOMATA TAKARÍTÁS', details: `${players} ligajátékos törölve (${LEAGUE_PLAYER_RETENTION_MONTHS} hónapja nem jelent meg).`, date: new Date() });
    }

    return NextResponse.json({ success: true, deletedCount: oldEventIds.length, preorderProducts: preorders.products, leaguePlayers: players });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}