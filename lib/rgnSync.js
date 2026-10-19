// Riftbound (RGN) jelentkezők szinkronizálása a naptár külső linkes eseményeihez.
// Adatbázis:
//  - tournaments.rgn: { id, syncedAt, ok, error, active, waitlist, capacity, lockUntil } – az utolsó lekérdezés állapota
//  - external_registrations: eseményenként a jelentkezők (Riot-azonosító, státusz, mikor jelentkezett / jelentkezett le)
//  - external_registration_events: előzmények (feliratkozott, lejelentkezett, visszajelentkezett, várólistára került, előlépett)
// A Riftbound oldalt eseményenként legfeljebb néhány percenként kérdezzük le (a hívó adja meg), és egyszerre csak egy
// szinkron fut eseményenként (zárolás), így a sűrű admin-frissítés sem terheli a külső oldalt.
import { rgnEventId, fetchRgnEvent, rgnIsActive, rgnIsWaitlist } from '@/lib/rgn';

const LOCK_MS = 30 * 1000;
const tid = (evt) => String(evt._id || evt.id);

async function addHistory(db, tournamentId, type, name, at) {
  await db.collection('external_registration_events').insertOne({ tournamentId, source: 'rgn', type, name, at: at || new Date() });
}

// Egy esemény szinkronizálása. Visszatérés: { ok, error?, active, waitlist }
export async function syncRgnEvent(db, evt) {
  const rgnId = rgnEventId(evt.external_url);
  if (!rgnId) return { ok: false, error: 'Nem Riftbound link.' };
  const tournaments = db.collection('tournaments');
  const now = new Date();

  // Zárolás: ha épp fut egy szinkron ehhez az eseményhez, nem indítunk újat
  const locked = await tournaments.findOneAndUpdate(
    { _id: evt._id, $or: [{ 'rgn.lockUntil': { $exists: false } }, { 'rgn.lockUntil': { $lt: now } }] },
    { $set: { 'rgn.lockUntil': new Date(now.getTime() + LOCK_MS), 'rgn.id': rgnId } }
  );
  if (!locked) return { ok: false, error: 'A szinkron már fut.' };

  try {
    const parsed = await fetchRgnEvent(rgnId);
    const eventId = tid(evt);
    const regs = db.collection('external_registrations');
    const current = parsed.registrants.filter(rgnIsActive);
    const existing = await regs.find({ tournamentId: eventId }).toArray();
    const byRgnId = new Map(existing.map(d => [d.rgnId, d]));
    const firstSync = existing.length === 0 && !evt.rgn?.syncedAt;
    const seen = new Set();

    for (const r of current) {
      const waitlist = rgnIsWaitlist(r);
      const registeredAt = r.registeredAt ? new Date(r.registeredAt) : null;
      // Ugyanaz a játékos újrajelentkezéskor új RGN-azonosítót kaphat: ilyenkor a korábbi sorát használjuk
      let doc = byRgnId.get(r.rgnId) || (r.playerId ? existing.find(d => d.playerId === r.playerId && !seen.has(String(d._id))) : null);
      const fields = { rgnId: r.rgnId, playerId: r.playerId, name: r.name, status: r.status, waitlist, waitlistPosition: r.waitlistPosition, registeredAt, checkedIn: r.checkedIn, lastSeenAt: now };
      if (!doc) {
        const inserted = await regs.insertOne({ tournamentId: eventId, source: 'rgn', ...fields, firstSeenAt: now, droppedAt: null });
        seen.add(String(inserted.insertedId));
        // Az első lekérdezéskor a már meglévő jelentkezőket a saját jelentkezési idejükkel rögzítjük
        await addHistory(db, eventId, waitlist ? 'waitlisted' : 'joined', r.name, firstSync ? (registeredAt || now) : now);
        continue;
      }
      seen.add(String(doc._id));
      if (doc.droppedAt) await addHistory(db, eventId, 'rejoined', r.name, now);
      else if (doc.waitlist && !waitlist) await addHistory(db, eventId, 'promoted', r.name, now);
      else if (!doc.waitlist && waitlist) await addHistory(db, eventId, 'waitlisted', r.name, now);
      await regs.updateOne({ _id: doc._id }, { $set: { ...fields, droppedAt: null } });
    }

    // Aki eddig fent volt, de most nincs a listán: lejelentkezett
    for (const d of existing) {
      if (seen.has(String(d._id)) || d.droppedAt) continue;
      await regs.updateOne({ _id: d._id }, { $set: { droppedAt: now } });
      await addHistory(db, eventId, 'left', d.name, now);
    }

    const active = current.filter(r => !rgnIsWaitlist(r)).length;
    const waitlist = current.length - active;
    await tournaments.updateOne({ _id: evt._id }, {
      $set: {
        rgn: { id: rgnId, syncedAt: now, ok: true, error: null, active, waitlist, capacity: parsed.capacity },
        current_players: active,
        queue_count: waitlist,
        ...(parsed.capacity ? { max_players: parsed.capacity } : {}),
      },
    });
    return { ok: true, active, waitlist };
  } catch (err) {
    const error = err?.name === 'AbortError' ? 'A Riftbound oldal nem válaszolt időben.' : (err?.message || 'Ismeretlen hiba.');
    await tournaments.updateOne({ _id: evt._id }, { $set: { 'rgn.syncedAt': now, 'rgn.ok': false, 'rgn.error': error, 'rgn.id': rgnId }, $unset: { 'rgn.lockUntil': '' } });
    return { ok: false, error };
  }
}

// A közelgő (és tegnapi) Riftbound-linkes események közül azokat szinkronizálja, amelyeket maxAgeMs-nál régebben
// kérdeztünk le. budgetMs: legfeljebb ennyi ideig várunk (a lassú külső oldal ne lassítsa sokáig az oldalt).
export async function syncDueRgnEvents(db, { maxAgeMs = 5 * 60 * 1000, budgetMs = 5000, limit = 8 } = {}) {
  const now = Date.now();
  const from = new Date(now - 24 * 3600 * 1000).toISOString().slice(0, 10);
  const candidates = await db.collection('tournaments')
    .find({ external_url: /playriftbound\.com\//i, date: { $gte: from } }, { projection: { external_url: 1, date: 1, rgn: 1, id: 1 } })
    .toArray();
  const due = candidates
    .filter(e => rgnEventId(e.external_url))
    .filter(e => !e.rgn?.syncedAt || now - new Date(e.rgn.syncedAt).getTime() > maxAgeMs)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(0, limit);
  if (!due.length) return 0;
  const work = Promise.allSettled(due.map(e => syncRgnEvent(db, e)));
  await Promise.race([work, new Promise(r => setTimeout(r, budgetMs))]);
  return due.length;
}

// Egy esemény jelentkezői és előzményei az admin felülethez
export async function getRgnRegistrations(db, tournamentIds) {
  if (!tournamentIds.length) return { registrations: [], history: [] };
  const [registrations, history] = await Promise.all([
    db.collection('external_registrations').find({ tournamentId: { $in: tournamentIds } }).sort({ registeredAt: 1, firstSeenAt: 1 }).toArray(),
    db.collection('external_registration_events').find({ tournamentId: { $in: tournamentIds } }).sort({ at: -1 }).limit(500).toArray(),
  ]);
  return {
    registrations: registrations.map(r => ({ id: String(r._id), tournamentId: r.tournamentId, name: r.name, status: r.status, waitlist: !!r.waitlist, waitlistPosition: r.waitlistPosition ?? null, registeredAt: r.registeredAt, firstSeenAt: r.firstSeenAt, droppedAt: r.droppedAt || null, checkedIn: !!r.checkedIn })),
    history: history.map(h => ({ id: String(h._id), tournamentId: h.tournamentId, type: h.type, name: h.name, at: h.at })),
  };
}
