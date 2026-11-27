// Heti takarítás (app/api/cron/cleanup): a régi adatok törlése, előtte mentés a Google Drive-ra (lib/googleDrive.js).
// 1) buildCleanupPlan: összegyűjti, mi törlődne (a teljes dokumentumokkal)
// 2) ha a Drive be van állítva: egy JSON-fájlba menti ezeket; ha a mentés nem sikerül, NEM töröl semmit (a hiba a
//    Rendszer oldalon látszik, a következő héten újra próbálja)
// 3) executeCleanupPlan: pontosan a mentett elemeket törli (azonosító szerint)
// Ha a Drive nincs beállítva, a takarítás a mentés nélkül fut (mint eddig); a Rendszer oldal ezt jelzi.
//
// Megőrzési idők:
//  - események (a jelentkezőkkel): 2 hónap a dátumuk után
//  - megjelenési előzmények: 1 év
//  - előrendelés: a lezárt termék a jelentkezőivel 6 hónappal a lezárás után (lib/retention.js)
//  - ligajátékos: 12 hónap megjelenés nélkül (lib/retention.js; a ranglistákban csak a becenév marad)
//  - asztalfoglalási kérés: 2 hónap (lib/tableBookings.js)
//  - beérkezett levelek, üzenetszálak (az utolsó üzenet után), napló: 12 hónap
import { PREORDER_RETENTION_MONTHS, LEAGUE_PLAYER_RETENTION_MONTHS } from './retention.js';
import { TABLE_RETENTION_MONTHS } from './tableBookings.js';
import { driveConfigured, saveToDrive } from './googleDrive.js';

export const EVENT_RETENTION_MONTHS = 2;
export const MAIL_RETENTION_MONTHS = 12;
export const LOG_RETENTION_MONTHS = 12;

const monthsAgo = (n, now) => { const d = new Date(now); d.setMonth(d.getMonth() - n); return d; };
const dayString = (d) => d.toISOString().slice(0, 10);

export async function buildCleanupPlan(db, now = new Date()) {
  const col = (n) => db.collection(n);
  // események: a dátumuk (szöveg) alapján, mint eddig
  const eventLimit = monthsAgo(EVENT_RETENTION_MONTHS, now);
  const tournaments = (await col('tournaments').find({}).toArray()).filter(e => new Date(e.date) < eventLimit);
  const eventIds = tournaments.map(e => String(e._id));
  const [registrations, externalRegistrations, externalEvents] = eventIds.length ? await Promise.all([
    col('registrations').find({ tournamentId: { $in: eventIds } }).toArray(),
    col('external_registrations').find({ tournamentId: { $in: eventIds } }).toArray(),
    col('external_registration_events').find({ tournamentId: { $in: eventIds } }).toArray(),
  ]) : [[], [], []];

  const yearAgo = new Date(now); yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const attendanceHistory = await col('attendance_history').find({ recordedAt: { $lt: yearAgo } }).toArray();

  const preorderProducts = await col('preorder_products').find({ isOpen: false, closedAt: { $lt: monthsAgo(PREORDER_RETENTION_MONTHS, now) } }).toArray();
  const preorders = preorderProducts.length ? await col('preorders').find({ productId: { $in: preorderProducts.map(p => String(p._id)) } }).toArray() : [];

  // ligajátékos: legalább 12 hónapja vették fel, és azóta egy alkalmon sem jelent meg
  const leagueLimit = monthsAgo(LEAGUE_PLAYER_RETENTION_MONTHS, now);
  const candidates = await col('league_players').find({ createdAt: { $lt: leagueLimit } }).toArray();
  let leaguePlayers = [];
  let leagueResults = [];
  if (candidates.length) {
    const recent = await col('league_sessions').find({ date: { $gte: dayString(leagueLimit) } }, { projection: { results: 1 } }).toArray();
    const active = new Set(recent.flatMap(s => (s.results || []).filter(r => r.attended).map(r => r.playerId)));
    leaguePlayers = candidates.filter(p => !active.has(String(p._id)));
    if (leaguePlayers.length) {
      const ids = new Set(leaguePlayers.map(p => String(p._id)));
      const sessions = await col('league_sessions').find({ 'results.playerId': { $in: [...ids] } }, { projection: { leagueId: 1, date: 1, results: 1 } }).toArray();
      leagueResults = sessions.map(s => ({ sessionId: String(s._id), leagueId: s.leagueId, date: s.date, results: (s.results || []).filter(r => ids.has(r.playerId)) }));
    }
  }

  const tableBookings = await col('table_bookings').find({ date: { $lt: dayString(monthsAgo(TABLE_RETENTION_MONTHS, now)) } }).toArray();
  const mailLimit = monthsAgo(MAIL_RETENTION_MONTHS, now);
  const inboxMails = await col('inbox_mails').find({ date: { $lt: mailLimit } }).toArray();
  const messageThreads = await col('message_threads').find({ lastAt: { $lt: mailLimit } }).toArray();
  const auditLogs = await col('audit_logs').find({ date: { $lt: monthsAgo(LOG_RETENTION_MONTHS, now) } }).toArray();

  const data = { tournaments, registrations, externalRegistrations, externalEvents, attendanceHistory, preorderProducts, preorders, leaguePlayers, leagueResults, tableBookings, inboxMails, messageThreads, auditLogs };
  const counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length]));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { at: now, data, counts, total };
}

const idsOf = (docs) => docs.map(d => d._id);

export async function executeCleanupPlan(db, plan) {
  const d = plan.data;
  const del = (name, docs) => (docs.length ? db.collection(name).deleteMany({ _id: { $in: idsOf(docs) } }) : null);
  await del('tournaments', d.tournaments);
  await del('registrations', d.registrations);
  await del('external_registrations', d.externalRegistrations);
  await del('external_registration_events', d.externalEvents);
  await del('attendance_history', d.attendanceHistory);
  await del('preorders', d.preorders);
  await del('preorder_products', d.preorderProducts);
  if (d.leaguePlayers.length) {
    const ids = d.leaguePlayers.map(p => String(p._id));
    await db.collection('league_sessions').updateMany({}, { $pull: { results: { playerId: { $in: ids } } } });
    await del('league_players', d.leaguePlayers);
  }
  await del('table_bookings', d.tableBookings);
  await del('inbox_mails', d.inboxMails);
  await del('message_threads', d.messageThreads);
  await del('audit_logs', d.auditLogs);
}

const LABELS = {
  tournaments: 'esemény', registrations: 'jelentkezés', preorderProducts: 'lezárt előrendelési termék', preorders: 'előrendelés',
  leaguePlayers: 'inaktív ligajátékos', tableBookings: 'asztalfoglalási kérés', inboxMails: 'beérkezett levél',
  messageThreads: 'üzenetszál', auditLogs: 'naplóbejegyzés', attendanceHistory: 'megjelenési előzmény',
};
export const describeCounts = (counts) => Object.entries(LABELS).filter(([k]) => counts[k]).map(([k, label]) => `${counts[k]} ${label}`).join(', ');

// A teljes takarítás. by: ki indította (napló). save: a Drive-mentés (a teszthez cserélhető).
// Visszaad: a törölt darabszámok és a mentés adatai ({ backup: { name, link } | null, backupSkipped }).
export async function runCleanup(db, { by = 'Vercel Automata', now = new Date(), save = saveToDrive } = {}) {
  const plan = await buildCleanupPlan(db, now);
  let backup = null;
  if (plan.total > 0 && driveConfigured()) {
    const name = `tavern-takaritas-${dayString(now)}.json`;
    // ha a mentés nem sikerül, kivételt dob: ilyenkor semmi nem törlődik
    backup = await save(db, name, { kind: 'Tavern naptár – heti takarítás előtti mentés', createdAt: now, counts: plan.counts, ...plan.data });
  }
  if (plan.total > 0) {
    await executeCleanupPlan(db, plan);
    await db.collection('audit_logs').insertOne({
      adminName: by, action: 'AUTOMATA TAKARÍTÁS', date: new Date(),
      details: `Törölve: ${describeCounts(plan.counts)}.${backup ? ` Előtte elmentve a Google Drive-ra: ${backup.name}.` : ' Google Drive-mentés nincs beállítva.'}`,
    });
  }
  return {
    deletedCount: plan.counts.tournaments, preorderProducts: plan.counts.preorderProducts, leaguePlayers: plan.counts.leaguePlayers,
    tableBookings: plan.counts.tableBookings, inboxMails: plan.counts.inboxMails, messageThreads: plan.counts.messageThreads, auditLogs: plan.counts.auditLogs,
    total: plan.total, backup: backup ? { name: backup.name, link: backup.link, bytes: backup.bytes } : null, backupSkipped: plan.total > 0 && !driveConfigured(),
  };
}
