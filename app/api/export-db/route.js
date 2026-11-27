import { getTavernDb } from '@/lib/mongodb';
import { logSystemError } from '@/lib/systemLog';
import { verifyOwner } from '@/lib/auth';
import { buildDbDump } from '@/lib/dbDump';

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

    const dbDump = await buildDbDump(db);

    return new Response(JSON.stringify(dbDump, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="tavern_db_mentes_${new Date().toISOString().split('T')[0]}.json"`
      }
    });
  } catch (error) {
    console.error('export-db error:', error);
    await logSystemError('export-db', error);
    return new Response(JSON.stringify({ error: 'Az exportálás nem sikerült.' }), { status: 500 });
  }
}