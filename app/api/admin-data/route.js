import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { verifyAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await verifyAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Jogosulatlan hozzáférés' }, { status: 401 });
    }

    // Ugyanazt a szabványos klienskapcsolatot használjuk, mint a publikus oldal
    const client = await clientPromise;
    // Ha a connection string tartalmaz adatbázis nevet, a .db() paraméter nélkül azt használja, 
    // ha nem, akkor a Tavern_DB-t / Tavern-t célozzuk meg biztonságosan:
    const db = client.db(process.env.MONGODB_DB || undefined);

    // Biztos ami biztos, lekérjük mindkét lehetséges helyről, ha eltérne a séma
    let tournaments = await db.collection('tournaments').find({}).toArray();
    if (tournaments.length === 0) {
      // Próbálkozás alternative Tavern adatbázis névvel is, ha az alapértelmezett üres lenne
      const altDb = client.db('Tavern');
      tournaments = await altDb.collection('tournaments').find({}).toArray();
    }

    const [registrations, users, logs, blacklist, settings] = await Promise.all([
      db.collection('registrations').find({}).toArray(),
      db.collection('users').find({}, { projection: { password: 0 } }).toArray(),
      db.collection('audit_logs').find({}).sort({ date: -1 }).limit(100).toArray(),
      db.collection('blacklist').find({}).toArray(),
      db.collection('settings').findOne({ _id: 'global_settings' })
    ]);

    return NextResponse.json({ 
        tournaments: tournaments || [], 
        registrations: registrations || [], 
        users: users || [], 
        logs: logs || [], 
        blacklist: blacklist || [], 
        isMaintenance: settings?.isMaintenance || false 
    });
  } catch (error) {
    return NextResponse.json({ error: "Adatbázis hiba: " + error.message }, { status: 500 });
  }
}