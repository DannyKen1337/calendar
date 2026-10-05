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

    const [tournaments, registrations, users, logs, blacklist, settings] = await Promise.all([
      db.collection('tournaments').find({}).toArray(),
      db.collection('registrations').find({}).toArray(),
      db.collection('users').find({}, { projection: { password: 0 } }).toArray(), // Jelszavakat sosem exportálunk!
      db.collection('audit_logs').find({}).sort({ date: -1 }).toArray(),
      db.collection('blacklist').find({}).toArray(),
      db.collection('settings').find({}).toArray(),
    ]);

    const dbDump = {
      exportDate: new Date(),
      tournaments,
      registrations,
      users,
      logs,
      blacklist,
      settings
    };

    return new Response(JSON.stringify(dbDump, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="tavern_db_mentes_${new Date().toISOString().split('T')[0]}.json"`
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Az exportálás nem sikerült.' }), { status: 500 });
  }
}