// A nyilvános naptár adata (a /api/public-data és a weboldal heti programja: weblap/lib/calendar.js).
// Gyorsítótárazva (lib/publicCache.js): legfeljebb 5 percig a tárolóból, de minden írás azonnal frissíti.
import { getTavernDb } from '@/lib/mongodb';
import { attachPublicAttendees } from '@/lib/attendance';
import { normalizeOccupancy, publicBookedSeats, publicReservedSeats } from '@/lib/occupancy';
import { budapestDateTime } from '@/lib/eventDates';
import { cachedPublic, TAG } from '@/lib/publicCache';

async function loadPublicCalendarData() {
    const db = await getTavernDb();

    const [tournaments, registrations, settings] = await Promise.all([
      // Az eseményt tartó szervezők (hosts) csak az adminoknak látszanak
      db.collection('tournaments').find({}, { projection: { hosts: 0, adminName: 0, userRole: 0, 'rgn.lockUntil': 0, 'rgn.error': 0 } } /* a létrehozó szervező fiókneve nem nyilvános (belépési név) */).toArray(),
      // Csak a megjelenítéshez szükséges mezők: e-mail cím nem kerül ki a nyilvános oldalra
      db.collection('registrations').find({}, { projection: { _id: 0, tournamentId: 1, name: 1, username: 1, status: 1, date: 1 } }).toArray(),
      db.collection('settings').findOne({ _id: 'global_settings' })
    ]);

    // Napi telítettség a nyilvános naptárban: csak ha a tulajdonos bekapcsolta és a nyilvános megjelenítést is engedte.
    // A kézi foglalásokból csak a helyek napi összege kerül ki, név nélkül.
    const occ = normalizeOccupancy(settings?.occupancy);
    let occupancy = null;
    if (occ.enabled && occ.public) {
      const from = budapestDateTime(Date.now() - 62 * 24 * 60 * 60 * 1000).slice(0, 10);
      const bookings = await db.collection('store_bookings').find({ date: { $gte: from } }, { projection: { _id: 0, store: 1, date: 1, seats: 1 } }).toArray();
      // a közösségi események lefoglalt helyei: csak a napi összeg, az eseményhez nem köthetően
      occupancy = { capacity: occ.capacity, booked: publicBookedSeats(bookings), reserved: publicReservedSeats(tournaments) };
    }

    // Elfogadott asztalfoglalások a naptárba: csak a bolt és az időpont, név és elérhetőség nélkül
    const tableBookingsFrom = budapestDateTime(Date.now() - 62 * 24 * 60 * 60 * 1000).slice(0, 10);
    const tableBookings = await db.collection('store_bookings')
      .find({ tableBookingId: { $exists: true }, date: { $gte: tableBookingsFrom } }, { projection: { _id: 0, store: 1, date: 1, from: 1, to: 1 } })
      .sort({ date: 1, from: 1 }).toArray();

    return {
        // A közösségi események helyszáma nem kerül ki a nyilvános oldalra
        tournaments: attachPublicAttendees(tournaments.map(({ reservedSeats, ...t }) => t), registrations),
        tableBookings,
        isMaintenance: settings?.isMaintenance || false,
        occupancy,
    };
}

export const getPublicCalendarData = cachedPublic(loadPublicCalendarData, 'naptar', [TAG.naptar]);
