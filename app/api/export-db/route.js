import { getTavernDb } from '@/lib/mongodb';
import { verifyOwner } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await verifyOwner();
    if (!session) {
      return new Response(JSON.stringify({ error: 'Csak Admin2 exportálhatja az adatbázist.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = await getTavernDb();
    await db.collection('audit_logs').insertOne({ adminName: session.username, action: 'ADATBÁZIS MENTÉS', details: 'Teljes adatbázis letöltése', date: new Date() });

    const [tournaments, registrations, users, logs, blacklist, settings, preorderProducts, preorders, leagues, leaguePlayers, leagueSessions, leagueSeasons] = await Promise.all([
      db.collection('tournaments').find({}).toArray(),
      db.collection('registrations').find({}).toArray(),
      db.collection('users').find({}, { projection: { password: 0 } }).toArray(), // Jelszavakat sosem exportálunk!
      db.collection('audit_logs').find({}).sort({ date: -1 }).toArray(),
      db.collection('blacklist').find({}).toArray(),
      db.collection('settings').find({}).toArray(),
      db.collection('preorder_products').find({}).toArray(),
      db.collection('preorders').find({}).toArray(),
      db.collection('leagues').find({}).toArray(),
      db.collection('league_players').find({}).toArray(),
      db.collection('league_sessions').find({}).toArray(),
      db.collection('league_seasons').find({}).toArray(),
    ]);

    const dbDump = {
      exportDate: new Date(),
      tournaments,
      registrations,
      users,
      logs,
      blacklist,
      settings,
      preorderProducts,
      preorders,
      leagues,
      leaguePlayers,
      leagueSessions,
      leagueSeasons,
    };

    return new Response(JSON.stringify(dbDump, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="tavern_db_mentes_${new Date().toISOString().split('T')[0]}.json"`
      }
    });
  } catch (error) {
    console.error('export-db error:', error);
    return new Response(JSON.stringify({ error: 'Az exportálás nem sikerült.' }), { status: 500 });
  }
}