// Rendszernapló a tulajdonosi Rendszer oldalhoz (csak szerveroldalon):
//  - system_errors: szerverhibák (hol, mi, mikor), 30 napig őrizzük
//  - system_runs: az időzített feladatok (cron) futásai, sikeres-e, mennyi ideig tartott
// A naplózás soha nem okozhat újabb hibát: minden hiba csendben elnyelődik.
import { getTavernDb } from '@/lib/mongodb';

const ERROR_TTL_SECONDS = 30 * 24 * 3600;
let indexesEnsured = false;

async function ensureIndexes(db) {
  if (indexesEnsured) return;
  indexesEnsured = true;
  await Promise.all([
    db.collection('system_errors').createIndex({ at: 1 }, { expireAfterSeconds: ERROR_TTL_SECONDS }),
    db.collection('system_runs').createIndex({ job: 1, at: -1 }),
  ]).catch(() => {});
}

export async function logSystemError(source, error, extra = null) {
  try {
    const db = await getTavernDb();
    await ensureIndexes(db);
    await db.collection('system_errors').insertOne({
      source: String(source).slice(0, 80),
      message: String(error?.message || error || 'Ismeretlen hiba').slice(0, 500),
      stack: String(error?.stack || '').split('\n').slice(0, 6).join('\n').slice(0, 1500),
      ...(extra ? { extra: JSON.parse(JSON.stringify(extra)) } : {}),
      at: new Date(),
    });
  } catch { /* a naplózás hibája nem befolyásolhatja a kérést */ }
}

// Időzített feladat futtatása mérve és naplózva. A fn visszatérési értéke a "details" lesz.
export async function recordRun(job, fn) {
  const started = Date.now();
  let ok = true, details = null, error = null;
  try {
    details = await fn();
  } catch (err) {
    ok = false;
    error = err;
  }
  try {
    const db = await getTavernDb();
    await ensureIndexes(db);
    await db.collection('system_runs').insertOne({ job, at: new Date(), ok, durationMs: Date.now() - started, details: details ? JSON.parse(JSON.stringify(details)) : null, error: error ? String(error.message || error).slice(0, 500) : null });
  } catch { /* nem akadályozhatja a feladatot */ }
  if (error) { await logSystemError(`cron:${job}`, error); throw error; }
  return details;
}
