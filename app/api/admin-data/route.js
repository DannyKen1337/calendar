import { NextResponse } from 'next/server';
import { getTavernDb } from '@/lib/mongodb';
import { verifyAdmin } from '@/lib/auth';
import { attachPublicAttendees } from '@/lib/attendance';
import { canManageEvent } from '@/lib/permissions';
import { getAttendanceStats } from '@/lib/attendanceHistory';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await verifyAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Jogosulatlan hozzáférés' }, { status: 401 });
    }
    const isOwner = session.role === 'owner';

    const db = await getTavernDb();

    const [tournaments, registrations, users, logs, blacklist, settings] = await Promise.all([
      db.collection('tournaments').find({}).toArray(),
      db.collection('registrations').find({}, { projection: { cancelToken: 0 } }).toArray(),
      // Felhasználók, napló és feketelista: csak a tulajdonosnak (a kezelésük is csak neki engedélyezett)
      isOwner ? db.collection('users').find({}, { projection: { password: 0 } }).toArray() : [],
      isOwner ? db.collection('audit_logs').find({}).sort({ date: -1 }).limit(100).toArray() : [],
      isOwner ? db.collection('blacklist').find({}).toArray() : [],
      db.collection('settings').findOne({ _id: 'global_settings' })
    ]);

    // A szervező minden eseményt lát (a nyilvános, rövidített jelentkezőnevekkel együtt),
    // de a teljes jelentkezési adatokat (e-mail) csak azoknál, amelyek játékát kezelheti
    const manageableIds = new Set(tournaments.filter(t => canManageEvent(session, t)).map(t => String(t._id || t.id)));
    const visibleRegistrations = isOwner ? registrations : registrations.filter(r => manageableIds.has(String(r.tournamentId)));

    // Megbízhatósági statisztika (megjelent / nem jelent meg) a látható jelentkezők e-mail címeire, az összes eseményből számolva
    const attendanceStats = await getAttendanceStats(db, visibleRegistrations.map(r => r.email));

    return NextResponse.json({
        tournaments: attachPublicAttendees(tournaments, registrations),
        registrations: visibleRegistrations,
        attendanceStats,
        users,
        logs,
        blacklist,
        isMaintenance: settings?.isMaintenance || false
    });
  } catch (error) {
    return NextResponse.json({ error: "Adatbázis hiba" }, { status: 500 });
  }
}
