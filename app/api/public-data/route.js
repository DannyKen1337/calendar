import { NextResponse } from 'next/server';
import { getTavernDb } from '@/lib/mongodb';
import { attachPublicAttendees } from '@/lib/attendance';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await getTavernDb();

    const [tournaments, registrations, settings] = await Promise.all([
      // Az eseményt tartó szervezők (hosts) csak az adminoknak látszanak
      db.collection('tournaments').find({}, { projection: { hosts: 0 } }).toArray(),
      // Csak a megjelenítéshez szükséges mezők: e-mail cím nem kerül ki a nyilvános oldalra
      db.collection('registrations').find({}, { projection: { _id: 0, tournamentId: 1, name: 1, username: 1, status: 1, date: 1 } }).toArray(),
      db.collection('settings').findOne({ _id: 'global_settings' })
    ]);

    return NextResponse.json({
        tournaments: attachPublicAttendees(tournaments, registrations),
        isMaintenance: settings?.isMaintenance || false 
    });
  } catch (error) {
    console.error('public-data error:', error);
    return NextResponse.json({ error: "Adatbázis hiba" }, { status: 500 });
  }
}