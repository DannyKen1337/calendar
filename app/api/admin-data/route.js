import { NextResponse, after } from 'next/server';
import { logSystemError } from '@/lib/systemLog';
import { getTavernDb } from '@/lib/mongodb';
import { verifyAdmin } from '@/lib/auth';
import { attachPublicAttendees } from '@/lib/attendance';
import { canManageEvent, canManageStore, hasFeature, seesPersonalData, canMessage } from '@/lib/permissions';
import { getAttendanceStats } from '@/lib/attendanceHistory';
import { effectiveAccess, getGroupsMap, ensureLevel1ForAll } from '@/lib/userAccess';
import { syncDueRgnEvents, getRgnRegistrations } from '@/lib/rgnSync';
import { rgnEventId } from '@/lib/rgn';
import { budapestDateTime } from '@/lib/eventDates';
import { normalizeOccupancy } from '@/lib/occupancy';
import { THREADS, messagingStatus } from '@/lib/messages';
import { syncMailbox } from '@/lib/mailboxSync';
import { appUrl } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const session = await verifyAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Jogosulatlan hozzáférés' }, { status: 401 });
    }
    const isOwner = session.role === 'owner';
    const pickAccess = (a) => ({ allowedCategories: a.allowedCategories, allowedStores: a.allowedStores });

    const db = await getTavernDb();
    // Egyszer: minden meglévő szervező megkapja a személyes adatok 1. szintjét
    await ensureLevel1ForAll(db).catch(err => console.error('1. szint:', err));
    // A rendszer postafiókja (válaszok, Beérkezett levelek): a háttérben, legfeljebb percenként (lib/mailboxSync.js)
    after(() => syncMailbox(db, appUrl(request)).catch(() => {}));

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
    // Az elfogadott asztalfoglalások kikapcsolt modulnál is látszanak a listában (a telítettség nélkül)
    const bookings = (await db.collection('store_bookings')
      .find({ date: { $gte: bookingsFrom }, ...(showOccupancy ? {} : { tableBookingId: { $exists: true } }) })
      .sort({ date: 1, from: 1 }).toArray()).map(b => ({ ...b, _id: String(b._id) }));

    // Asztalfoglalási kérések (elérhetőségekkel): csak az „Asztalfoglalás” joggal, a kezelt boltokból
    const tableBookings = hasFeature(session, 'tableBookings')
      ? (await db.collection('table_bookings').find({}).sort({ date: 1, from: 1 }).toArray())
        .filter(b => canManageStore(session, b.store))
        .map(({ _id, ...b }) => ({ ...b, id: String(_id) }))
      : [];

    // A szervező minden eseményt lát (a nyilvános, rövidített jelentkezőnevekkel együtt),
    // de a teljes jelentkezési adatokat (e-mail) csak azoknál, amelyek játékát kezelheti
    const manageableIds = new Set(tournaments.filter(t => canManageEvent(session, t)).map(t => String(t._id || t.id)));
    const visibleRegistrations = isOwner ? registrations : registrations.filter(r => manageableIds.has(String(r.tournamentId)));

    // Megbízhatósági statisztika (megjelent / nem jelent meg) a látható jelentkezők e-mail címeire, az összes eseményből számolva
    // A statisztika a jelentkezés azonosítójához kötve megy ki (az e-mail cím 1. szinten nem kerülhet a böngészőbe)
    const statsByEmail = await getAttendanceStats(db, visibleRegistrations.map(r => r.email));
    const attendanceStats = Object.fromEntries(visibleRegistrations.filter(r => r.email && statsByEmail[r.email]).map(r => [String(r._id), statsByEmail[r.email]]));

    // 1. szint (személyes adatok joga nélkül): a jelentkezőnek csak a felhasználóneve és a teljes neve látszik; e-mail helyett
    // csak az, hogy írható-e neki üzenet a rendszeren keresztül (/api/messages)
    const fullData = seesPersonalData(session);
    const shownRegistrations = fullData ? visibleRegistrations : visibleRegistrations.map(({ email, ...r }) => ({ ...r, hasEmail: !!email }));

    // Riftbound jelentkezők (Riot-azonosítók) és előzmények: csak a kezelhető eseményekhez
    const rgnIds = tournaments.filter(t => rgnEventId(t.external_url) && manageableIds.has(String(t._id || t.id))).map(t => String(t._id || t.id));
    const rgn = await getRgnRegistrations(db, rgnIds).catch(() => ({ registrations: [], history: [] }));

    return NextResponse.json({
        tournaments: attachPublicAttendees(tournaments, registrations),
        registrations: shownRegistrations,
        // Üzenetek: a szint, a kiküldés állapota és az olvasatlan válaszok száma (a saját szálakban)
        messaging: { personalData: fullData, canMessage: canMessage(session), ...messagingStatus(), unread: await db.collection(THREADS).countDocuments({ createdById: String(session.id), unread: true }) },
        attendanceStats,
        rgn,
        users,
        staff: staff.filter(u => !u.disabled).map(u => ({ id: String(u._id), username: u.username, role: u.role, ...pickAccess(effectiveAccess(u, groupsById)) })),
        logs,
        blacklist,
        isMaintenance: settings?.isMaintenance || false,
        occupancy: showOccupancy ? occupancy : { enabled: false, public: false, capacity: {} },
        bookings,
        tableBookings,
        serverTime: Date.now()
    });
  } catch (error) {
    console.error('admin-data error:', error);
    await logSystemError('admin-data', error);
    return NextResponse.json({ error: "Adatbázis hiba" }, { status: 500 });
  }
}
