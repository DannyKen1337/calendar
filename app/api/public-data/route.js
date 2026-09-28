import { NextResponse } from 'next/server';
import { getTavernDb } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await getTavernDb();

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