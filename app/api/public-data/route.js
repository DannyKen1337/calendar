import { NextResponse } from 'next/server';
import { logSystemError } from '@/lib/systemLog';
import { getTavernDb } from '@/lib/mongodb';
import { getExtraLinks } from '@/lib/extraLinks';
import { attachPublicAttendees } from '@/lib/attendance';
import { syncDueRgnEvents } from '@/lib/rgnSync';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await getTavernDb();
    // A Riftbound események létszáma a nyilvános naptárhoz: eseményenként legfeljebb 15 percenként frissül
    await syncDueRgnEvents(db, { maxAgeMs: 15 * 60 * 1000, budgetMs: 2500 }).catch(() => {});

    const [tournaments, registrations, settings] = await Promise.all([
      // Az eseményt tartó szervezők (hosts) csak az adminoknak látszanak
      db.collection('tournaments').find({}, { projection: { hosts: 0, 'rgn.lockUntil': 0, 'rgn.error': 0 } }).toArray(),
      // Csak a megjelenítéshez szükséges mezők: e-mail cím nem kerül ki a nyilvános oldalra
      db.collection('registrations').find({}, { projection: { _id: 0, tournamentId: 1, name: 1, username: 1, status: 1, date: 1 } }).toArray(),
      db.collection('settings').findOne({ _id: 'global_settings' })
    ]);

    return NextResponse.json({
        tournaments: attachPublicAttendees(tournaments, registrations),
        isMaintenance: settings?.isMaintenance || false,
        serverTime: Date.now(),
        extraLinks: await getExtraLinks(db).catch(() => ({ leagues: false })) 
    });
  } catch (error) {
    console.error('public-data error:', error);
    await logSystemError('public-data', error);
    return NextResponse.json({ error: "Adatbázis hiba" }, { status: 500 });
  }
}