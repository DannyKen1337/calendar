import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { verifyAdmin } from '@/lib/auth'; // Behozzuk a védelmet!

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    // 1. BIZTONSÁGI KAPU: Csak bejelentkezett admin láthatja ezeket az adatokat!
    const session = await verifyAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Jogosulatlan hozzáférés' }, { status: 401 });
    }

    const client = await clientPromise;
    // 2. A MEGOLDÁS: Kifejezetten a Tavern adatbázisra mutatunk!
    const db = client.db('Tavern');
    
    const [tournaments, registrations, users, logs, blacklist, settings] = await Promise.all([
      db.collection('tournaments').find({}).toArray(),
      db.collection('registrations').find({}).toArray(),
      // A felhasználóknál a jelszavakat (password) sosem küldjük ki a frontendnek biztonsági okokból!
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