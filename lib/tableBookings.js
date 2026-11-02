// Asztalfoglalás: a látogató a nyilvános oldalon (/asztalfoglalas) kérést küld, az „Asztalfoglalás” joggal rendelkező
// szervező a saját boltjaiban elfogadja vagy elutasítja. Elfogadáskor kézi helyfoglalás is keletkezik (store_bookings,
// tableBookingId mezővel): ez jelenik meg az admin listában, név nélkül a nyilvános naptárban, és beleszámít a napi telítettségbe.
// Gyűjtemény: table_bookings. Állapot: pending → accepted | rejected; accepted → cancelled.
import { STORE_NAMES } from '@/lib/permissions';
import { STORE_HOURS } from '@/lib/storeHours';
import { normalizePhone } from '@/lib/preorders';
import { isValidEmail } from '@/lib/rateLimit';
import { budapestDateTime } from '@/lib/eventDates';

export const TABLE_NOTE_MAX = 500;
export const TABLE_RETENTION_MONTHS = 2;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const DECISIONS = {
  accept: { from: 'pending', to: 'accepted' },
  reject: { from: 'pending', to: 'rejected' },
  cancel: { from: 'accepted', to: 'cancelled' },
};

// A bolt nyitvatartása az adott napon: ['15:00', '21:00'], null = zárva, undefined = nincs megadva
export function storeHoursOn(store, date) {
  if (!DAY_RE.test(String(date || ''))) return undefined;
  return STORE_HOURS[store]?.[new Date(`${date}T12:00:00Z`).getUTCDay()];
}

// Beküldött kérés ellenőrzése. Visszaad: { booking } vagy { error, field }
export function sanitizeTableRequest(input, now = Date.now()) {
  const name = String(input?.name ?? '').trim().replace(/\s+/g, ' ');
  if (!name || name.length > 120) return { error: 'Add meg a neved.', field: 'name' };
  const email = String(input?.email ?? '').trim().toLowerCase();
  if (!isValidEmail(email)) return { error: 'Érvényes e-mail címet adj meg.', field: 'email' };
  const phone = normalizePhone(input?.phone);
  if (!phone) return { error: 'Érvényes telefonszámot adj meg (pl. +36 30 123 4567).', field: 'phone' };
  const store = String(input?.store ?? '');
  if (!Object.hasOwn(STORE_NAMES, store)) return { error: 'Válassz boltot.', field: 'store' };
  const date = String(input?.date ?? '');
  if (!DAY_RE.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`))) return { error: 'Válassz napot.', field: 'date' };
  const from = String(input?.from ?? '');
  const to = String(input?.to ?? '');
  if (!TIME_RE.test(from)) return { error: 'Add meg a kezdés időpontját.', field: 'from' };
  if (!TIME_RE.test(to)) return { error: 'Add meg a befejezés időpontját.', field: 'to' };
  if (from >= to) return { error: 'A befejezés legyen a kezdés után.', field: 'to' };
  if (`${date}T${from}` < budapestDateTime(now)) return { error: 'Ez az időpont már elmúlt.', field: 'date' };
  const hours = storeHoursOn(store, date);
  if (hours === null) return { error: 'A bolt ezen a napon zárva van.', field: 'date' };
  if (hours && (from < hours[0] || to > hours[1])) return { error: `A bolt ezen a napon ${hours[0]} és ${hours[1]} között van nyitva.`, field: 'from' };
  const note = String(input?.note ?? '').trim().slice(0, TABLE_NOTE_MAX);
  return { booking: { name, email, phone, store, date, from, to, note } };
}

// Lejárt foglalási kérések törlése (személyes adatok; a heti takarítás hívja, lásd app/api/cron/cleanup)
export async function deleteOldTableBookings(db, now = new Date()) {
  const limit = new Date(now);
  limit.setMonth(limit.getMonth() - TABLE_RETENTION_MONTHS);
  const res = await db.collection('table_bookings').deleteMany({ date: { $lt: limit.toISOString().slice(0, 10) } });
  return res.deletedCount;
}

export const tableBookingWhen = (b) => `${b.date} ${b.from}–${b.to}`;
