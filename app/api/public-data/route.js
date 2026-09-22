import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const client = await clientPromise;
    // ITT IS A LÉNYEG: A helyes adatbázis!
    const db = client.db('Tavern');

    const [tournaments, settings] = await Promise.all([
      db.collection('tournaments').find({}).toArray(),
      db.collection('settings').findOne({ _id: 'global_settings' })
    ]);

    return NextResponse.json({ 
        tournaments,
        isMaintenance: settings?.isMaintenance || false 
    });
  } catch (error) {
    return NextResponse.json({ error: "Adatbázis hiba" }, { status: 500 });
  }
}