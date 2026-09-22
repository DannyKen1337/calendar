import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { verifyAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. LÉPÉS: Szigorú jogosultság-ellenőrzés (Token alapján!)
    const session = await verifyAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Jogosulatlan hozzáférés' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db();
    
    const [tournaments, registrations, users, logs, blacklist, settings] = await Promise.all([
      db.collection('tournaments').find({}).toArray(),
      db.collection('registrations').find({}).toArray(),
      // KRITIKUS JAVÍTÁS: A jelszavak sosem hagyhatják el az adatbázist!
      db.collection('users').find({}, { projection: { password: 0 } }).toArray(),
      db.collection('audit_logs').find({}).sort({ date: -1 }).limit(100).toArray(),
      db.collection('blacklist').find({}).toArray(),
      db.collection('settings').findOne({ _id: 'global_settings' })
    ]);

    return NextResponse.json({ 
        tournaments, 
        registrations, 
        users, 
        logs: logs || [], 
        blacklist: blacklist || [], 
        isMaintenance: settings?.isMaintenance || false 
    });
  } catch (error) {
    return NextResponse.json({ error: "Adatbázis hiba" }, { status: 500 });
  }
}