import { NextResponse } from 'next/server';
import { getTavernDb } from '@/lib/mongodb';
import { verifyOwner } from '@/lib/auth';
import { logSystemError } from '@/lib/systemLog';
import { rgnEventId } from '@/lib/rgn';
import { budapestDateTime } from '@/lib/eventDates';

export const dynamic = 'force-dynamic';

// Tulajdonosi Rendszer oldal: mi működik és mikor futott utoljára (adatbázis, időzített feladatok, Riftbound szinkron,
// beállítások, szerverhibák, biztonsági számlálók, aktivitás). Titkos értéket soha nem ad vissza, csak hogy be van-e állítva.

const DAY = 24 * 3600 * 1000;
// Az időzített feladatok (vercel.json) és hogy mennyi idő után számít késésnek, ha nem futott
const JOBS = [
  { job: 'cleanup', label: 'Heti takarítás', schedule: 'Hétfőnként 03:00 (UTC)', maxGapMs: 8 * DAY, description: 'Régi események, lejárt előrendelések, inaktív ligajátékosok törlése' },
  { job: 'rgn-sync', label: 'Riftbound szinkron (napi)', schedule: 'Naponta 05:00 (UTC)', maxGapMs: 26 * 3600 * 1000, description: 'A külső oldalas események jelentkezőinek frissítése' },
];
const RATE_LIMITS = [
  { prefix: 'login:', label: 'Bejelentkezési próbálkozás', limit: '20 / 15 perc / IP' },
  { prefix: 'join-ip:', label: 'Jelentkezés (IP)', limit: '60 / óra / IP' },
  { prefix: 'join:', label: 'Jelentkezés (e-mail)', limit: '15 / óra / e-mail' },
  { prefix: 'unsub-ip:', label: 'Leiratkozás (IP)', limit: '30 / óra / IP' },
  { prefix: 'preorder-ip:', label: 'Előrendelés (IP)', limit: '40 / óra / IP' },
  { prefix: 'preorder:', label: 'Előrendelés (e-mail)', limit: '10 / óra / e-mail' },
  { prefix: 'setup:', label: 'Jelszóbeállítás', limit: '10 / óra / fiók' },
];
const set = (name) => Boolean(process.env[name] && String(process.env[name]).trim());
const budapestDay = (d) => new Date(d).toLocaleDateString('sv-SE', { timeZone: 'Europe/Budapest' });

export async function GET() {
  try {
    const session = await verifyOwner();
    if (!session) return NextResponse.json({ error: 'Ezt az oldalt csak a tulajdonos láthatja.' }, { status: 403 });
    const db = await getTavernDb();

    const pingStart = Date.now();
    let dbOk = true, dbError = null;
    try { await db.command({ ping: 1 }); } catch (err) { dbOk = false; dbError = err.message; }
    const dbLatencyMs = Date.now() - pingStart;

    const now = Date.now();
    const nowLocal = budapestDateTime(new Date(now));
    const since24h = new Date(now - DAY);
    const since14d = new Date(now - 14 * DAY);

    const [
      settings, users, upcoming, products, preorderCount, leagues,
      runs, errors, errors24h, rateRows, activityRows, logs24h, rgnEvents,
    ] = await Promise.all([
      db.collection('settings').findOne({ _id: 'global_settings' }),
      db.collection('users').find({}, { projection: { username: 1, role: 1, disabled: 1, lastLoginAt: 1 } }).toArray(),
      db.collection('tournaments').find({ date: { $gte: nowLocal } }, { projection: { _id: 1 } }).toArray(),
      db.collection('preorder_products').find({}, { projection: { isOpen: 1 } }).toArray(),
      db.collection('preorders').countDocuments({}),
      db.collection('leagues').countDocuments({}),
      db.collection('system_runs').find({}).sort({ at: -1 }).limit(60).toArray(),
      db.collection('system_errors').find({}).sort({ at: -1 }).limit(50).toArray(),
      db.collection('system_errors').countDocuments({ at: { $gte: since24h } }),
      // A rate_limits bejegyzések 24 óra után maguktól törlődnek, így ez pont az utolsó nap
      db.collection('rate_limits').aggregate([{ $group: { _id: { $arrayElemAt: [{ $split: ['$key', ':'] }, 0] }, count: { $sum: 1 } } }]).toArray(),
      db.collection('audit_logs').aggregate([
        { $match: { date: { $gte: since14d } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'Europe/Budapest' } }, count: { $sum: 1 } } },
      ]).toArray(),
      db.collection('audit_logs').countDocuments({ date: { $gte: since24h } }),
      db.collection('tournaments').find({ external_url: /playriftbound\.com\//i, date: { $gte: budapestDateTime(new Date(now - DAY)).slice(0, 10) } }, { projection: { name: 1, date: 1, store: 1, external_url: 1, rgn: 1 } }).sort({ date: 1 }).toArray(),
    ]);
    // A jelentkezéseknél a tournamentId régebben ObjectId, újabban szöveg: mindkettőt keressük
    const upcomingIds = upcoming.flatMap(t => [t._id, String(t._id)]);
    const upcomingRegistrations = upcomingIds.length ? await db.collection('registrations').countDocuments({ tournamentId: { $in: upcomingIds } }) : 0;

    // Időzített feladatok: utolsó futás, késik-e, előzmények
    const jobs = JOBS.map(j => {
      const history = runs.filter(r => r.job === j.job).slice(0, 10);
      const last = history[0] || null;
      const lastOk = history.find(r => r.ok) || null;
      const overdue = !last || now - new Date(last.at).getTime() > j.maxGapMs;
      return {
        ...j, maxGapMs: undefined,
        status: !last ? 'unknown' : !last.ok ? 'error' : overdue ? 'late' : 'ok',
        lastRun: last && { at: last.at, ok: last.ok, durationMs: last.durationMs, details: last.details, error: last.error },
        lastSuccessAt: lastOk?.at || null,
        history: history.map(r => ({ at: r.at, ok: r.ok, durationMs: r.durationMs, details: r.details, error: r.error })),
      };
    });

    // Riftbound: eseményenként az utolsó lekérdezés
    const rgn = rgnEvents.filter(e => rgnEventId(e.external_url)).map(e => ({
      id: String(e._id), name: e.name, date: e.date, store: e.store || null, url: e.external_url,
      syncedAt: e.rgn?.syncedAt || null, ok: e.rgn?.syncedAt ? e.rgn.ok !== false : null, error: e.rgn?.error || null,
      active: e.rgn?.active ?? null, waitlist: e.rgn?.waitlist ?? null, capacity: e.rgn?.capacity ?? null,
    }));
    const rgnFailed = rgn.filter(e => e.ok === false).length;
    const rgnStale = rgn.filter(e => !e.syncedAt || now - new Date(e.syncedAt).getTime() > 26 * 3600 * 1000).length;

    const rateCounts = new Map(rateRows.map(r => [`${r._id}:`, r.count]));
    const activityByDay = new Map(activityRows.map(r => [r._id, r.count]));
    const activity = Array.from({ length: 14 }, (_, i) => {
      const day = budapestDay(now - (13 - i) * DAY);
      return { day, count: activityByDay.get(day) || 0 };
    });

    const mailReady = set('RESEND_API_KEY') && set('MAIL_FROM');
    const integrations = [
      { key: 'db', label: 'Adatbázis (MongoDB)', ok: dbOk, detail: dbOk ? `Válaszidő: ${dbLatencyMs} ms` : dbError },
      { key: 'jwt', label: 'Bejelentkezési titok (JWT_SECRET)', ok: set('JWT_SECRET'), detail: set('JWT_SECRET') ? 'Beállítva' : 'Hiányzik – a bejelentkezés nem biztonságos' },
      { key: 'cron', label: 'Időzített feladatok kulcsa (CRON_SECRET)', ok: set('CRON_SECRET'), detail: set('CRON_SECRET') ? 'Beállítva' : 'Hiányzik – a takarítás és a napi szinkron nem fut le' },
      { key: 'mail', label: 'E-mail küldés (Resend)', ok: mailReady, optional: true, detail: mailReady ? 'Beállítva' : 'Még nincs beállítva (RESEND_API_KEY, MAIL_FROM)' },
      { key: 'appUrl', label: 'Oldal címe (APP_URL)', ok: set('APP_URL'), optional: true, detail: set('APP_URL') ? 'Beállítva' : 'Nincs megadva – a kérésből számolja' },
      { key: 'imgbb', label: 'Képfeltöltés (ImgBB)', ok: set('IMGBB_API_KEY'), optional: true, detail: set('IMGBB_API_KEY') ? 'Beállítva' : 'Nincs beállítva' },
      { key: 'privacy', label: 'Adatkezelési tájékoztató linkje', ok: set('NEXT_PUBLIC_PRIVACY_URL'), optional: true, detail: set('NEXT_PUBLIC_PRIVACY_URL') ? 'Beállítva' : 'Nincs megadva' },
      { key: 'register', label: 'Nyilvános regisztráció (ALLOW_PUBLIC_REGISTER)', ok: true, optional: true, info: true, state: process.env.ALLOW_PUBLIC_REGISTER === 'true' ? 'Engedélyezve' : 'Kikapcsolva', detail: 'Új fiók létrehozása meghívás nélkül' },
    ];

    const lastLogins = users.filter(u => u.lastLoginAt).sort((a, b) => new Date(b.lastLoginAt) - new Date(a.lastLoginAt)).slice(0, 8)
      .map(u => ({ username: u.username, role: u.role, at: u.lastLoginAt }));

    return NextResponse.json({
      serverTime: now,
      version: {
        commit: process.env.VERCEL_GIT_COMMIT_SHA ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7) : null,
        message: process.env.VERCEL_GIT_COMMIT_MESSAGE ? process.env.VERCEL_GIT_COMMIT_MESSAGE.split('\n')[0].slice(0, 200) : null,
        env: process.env.VERCEL_ENV || process.env.NODE_ENV || null,
        region: process.env.VERCEL_REGION || null,
      },
      maintenance: settings?.isMaintenance || false,
      db: { ok: dbOk, latencyMs: dbLatencyMs, error: dbError },
      integrations,
      jobs,
      rgn: { events: rgn, failed: rgnFailed, stale: rgnStale },
      errors: errors.map(e => ({ id: String(e._id), source: e.source, message: e.message, stack: e.stack, at: e.at })),
      errors24h,
      security: RATE_LIMITS.map(r => ({ ...r, count: rateCounts.get(r.prefix) || 0 })),
      activity,
      logs24h,
      lastLogins,
      counts: {
        users: users.length,
        admins: users.filter(u => u.role === 'admin' || u.role === 'owner').length,
        disabledUsers: users.filter(u => u.disabled).length,
        upcomingEvents: upcoming.length,
        upcomingRegistrations,
        openProducts: products.filter(p => p.isOpen).length,
        products: products.length,
        preorders: preorderCount,
        leagues,
      },
    });
  } catch (error) {
    console.error('admin-system error:', error);
    await logSystemError('admin-system', error);
    return NextResponse.json({ error: 'A rendszerállapot lekérése nem sikerült.' }, { status: 500 });
  }
}
