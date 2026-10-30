import { NextResponse } from 'next/server';
import { logSystemError } from '@/lib/systemLog';
import { getTavernDb } from '@/lib/mongodb';
import { getExtraLinks } from '@/lib/extraLinks';
import { verifyAdmin } from '@/lib/auth';
import { attachPublicAttendees } from '@/lib/attendance';
import { canManageEvent } from '@/lib/permissions';
import { getAttendanceStats } from '@/lib/attendanceHistory';
import { effectiveAccess, getGroupsMap } from '@/lib/userAccess';
import { syncDueRgnEvents, getRgnRegistrations } from '@/lib/rgnSync';
import { rgnEventId } from '@/lib/rgn';
import { budapestDateTime } from '@/lib/eventDates';
import { normalizeOccupancy } from '@/lib/occupancy';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await verifyAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Jogosulatlan hozzáférés' }, { status: 401 });
    }
    const isOwner = session.role === 'owner';
    const pickAccess = (a) => ({ allowedCategories: a.allowedCategories, allowedStores: a.allowedStores });

    const db = await getTavernDb();

    // Riftbound (külső oldalas) események jelentkezőinek frissítése: eseményenként legfeljebb 5 percenként, legfeljebb 4 mp várakozással
    await syncDueRgnEvents(db, { maxAgeMs: 5 * 60 * 1000, budgetMs: 4000 }).catch(err => console.error('rgn sync error:', err));

    const [tournaments, registrations, users, logs, blacklist, settings, staff] = await Promise.all([
      db.collection('tournaments').find({}).toArray(),
      db.collection('registrations').find({}, { projection: { cancelToken: 0 } }).toArray(),
      // Felhasználók, napló és feketelista: csak a tulajdonosnak (a kezelésük is csak neki engedélyezett)
      isOwner ? db.collection('users').find({}, { projection: { password: 0 } }).toArray() : [],
      // A tevékenységnapló (csak a tulajdonos látja): a legutóbbi 500 bejegyzés
      isOwner ? db.collection('audit_logs').find({}).sort({ date: -1 }).limit(500).toArray() : [],
      isOwner ? db.collection('blacklist').find({}).toArray() : [],
      db.collection('settings').findOne({ _id: 'global_settings' }),
      // Az esemény szervezőjének választható adminok (név + játék-jogosultság): minden adminnak kell az űrlaphoz
      db.collection('users').find({ role: { $in: ['admin', 'owner'] } }, { projection: { username: 1, role: 1, allowedCategories: 1, allowedStores: 1, features: 1, groupIds: 1, accessMode: 1, disabled: 1 } }).sort({ username: 1 }).toArray(),
    ]);

    const groupsById = await getGroupsMap(db);

    // Napi telítettség: a tulajdonos mindig látja; a többi szervező csak bekapcsolt modulnál (a beállítás és a kézi foglalások)
    const occupancy = normalizeOccupancy(settings?.occupancy);
    const showOccupancy = isOwner || occupancy.enabled;
    const bookingsFrom = budapestDateTime(Date.now() - 62 * 24 * 60 * 60 * 1000).slice(0, 10);
    const bookings = showOccupancy
      ? (await db.collection('store_bookings').find({ date: { $gte: bookingsFrom } }).sort({ date: 1, from: 1 }).toArray()).map(b => ({ ...b, _id: String(b._id) }))
      : [];

    // A szervező minden eseményt lát (a nyilvános, rövidített jelentkezőnevekkel együtt),
    // de a teljes jelentkezési adatokat (e-mail) csak azoknál, amelyek játékát kezelheti
    const manageableIds = new Set(tournaments.filter(t => canManageEvent(session, t)).map(t => String(t._id || t.id)));
    const visibleRegistrations = isOwner ? registrations : registrations.filter(r => manageableIds.has(String(r.tournamentId)));

    // Megbízhatósági statisztika (megjelent / nem jelent meg) a látható jelentkezők e-mail címeire, az összes eseményből számolva
    const attendanceStats = await getAttendanceStats(db, visibleRegistrations.map(r => r.email));

    // Riftbound jelentkezők (Riot-azonosítók) és előzmények: csak a kezelhető eseményekhez
    const rgnIds = tournaments.filter(t => rgnEventId(t.external_url) && manageableIds.has(String(t._id || t.id))).map(t => String(t._id || t.id));
    const rgn = await getRgnRegistrations(db, rgnIds).catch(() => ({ registrations: [], history: [] }));

    return NextResponse.json({
        tournaments: attachPublicAttendees(tournaments, registrations),
        registrations: visibleRegistrations,
        attendanceStats,
        rgn,
        users,
        staff: staff.filter(u => !u.disabled).map(u => ({ id: String(u._id), username: u.username, role: u.role, ...pickAccess(effectiveAccess(u, groupsById)) })),
        logs,
        blacklist,
        isMaintenance: settings?.isMaintenance || false,
        occupancy: showOccupancy ? occupancy : { enabled: false, public: false, capacity: {} },
        bookings,
        serverTime: Date.now(),
        extraLinks: await getExtraLinks(db).catch(() => ({ leagues: false }))
    });
  } catch (error) {
    console.error('admin-data error:', error);
    await logSystemError('admin-data', error);
    return NextResponse.json({ error: "Adatbázis hiba" }, { status: 500 });
  }
}
