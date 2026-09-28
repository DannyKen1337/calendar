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

    const [tournaments, registrations, users] = await Promise.all([
      db.collection('tournaments').find({}).toArray(),
      db.collection('registrations').find({}).toArray(),
      db.collection('users').find({}, { projection: { password: 0 } }).toArray() // Jelszavakat sosem exportálunk!
    ]);

    const dbDump = {
      exportDate: new Date(),
      tournaments,
      registrations,
      users
    };

    return new Response(JSON.stringify(dbDump, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="tavern_db_mentes_${new Date().toISOString().split('T')[0]}.json"`
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}