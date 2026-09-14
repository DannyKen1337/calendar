import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const client = await clientPromise;
    const db = client.db();
    const [tournaments, registrations, users, logs, blacklist, settings] = await Promise.all([
      db.collection('tournaments').find({}).toArray(),
      db.collection('registrations').find({}).toArray(),
      db.collection('users').find({}).toArray(),
      db.collection('audit_logs').find({}).sort({ date: -1 }).limit(100).toArray(), // Csak az utolsó 100 napló bejegyzés
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