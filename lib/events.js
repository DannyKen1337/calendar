import { ObjectId } from 'mongodb';
import { getTavernDb } from '@/lib/mongodb';
import { attachPublicAttendees } from '@/lib/attendance';

// Egy esemény betöltése a nyilvános eseményoldalhoz (/esemeny/[id]) a rövidített jelentkezőnevekkel, e-mail címek nélkül.
// Régi eseményeknél az azonosító az "id" mezőben is lehet, ezért mindkettőt nézzük.
export async function getPublicEvent(id) {
  const tId = String(id || '');
  if (!tId || tId.length > 100) return null;
  const db = await getTavernDb();
  const or = [{ id: tId }];
  if (ObjectId.isValid(tId) && tId.length === 24) or.push({ _id: new ObjectId(tId) });
  const event = await db.collection('tournaments').findOne({ $or: or });
  if (!event) return null;

  const eventId = String(event._id || event.id);
  const registrations = await db.collection('registrations')
    .find({ tournamentId: { $in: [eventId, tId] } }, { projection: { _id: 0, tournamentId: 1, name: 1, username: 1, status: 1, date: 1 } })
    .toArray();
  const [withAttendees] = attachPublicAttendees([event], registrations.map(r => ({ ...r, tournamentId: eventId })));
  // Szerver -> kliens átadáshoz egyszerű JSON (az ObjectId és a Date szöveggé alakul)
  return JSON.parse(JSON.stringify(withAttendees));
}

export async function isMaintenanceOn() {
  const db = await getTavernDb();
  const settings = await db.collection('settings').findOne({ _id: 'global_settings' });
  return !!settings?.isMaintenance;
}

// Az esemény dátuma magyar helyi idő szövegként ("2026-10-05T18:00"); a szerver UTC-ben fut, ezért nem new Date()-tel formázzuk
const HU_MONTHS = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
const HU_DAYS = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];

export function formatEventDateHu(dateStr) {
  const m = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return '';
  const [, y, mo, d, h, mi] = m;
  const weekday = HU_DAYS[new Date(Date.UTC(+y, +mo - 1, +d)).getUTCDay()];
  return `${y}. ${HU_MONTHS[+mo - 1]} ${+d}. (${weekday}) ${h}:${mi}`;
}
