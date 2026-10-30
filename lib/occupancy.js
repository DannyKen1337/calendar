// Napi telítettség modul.
// - Minden boltnak egy napi férőhelye van (fő), amit a tulajdonos boltonként egyszer állít be; minden napra érvényes.
// - A nap foglaltsága = a bolt aznapi eseményeinek jelentkezői + a kézi helyfoglalások (store_bookings gyűjtemény).
// - A modul alapból ki van kapcsolva: ilyenkor csak a tulajdonos látja. Bekapcsolva a szervezők is látják és kezelhetik
//   (a saját boltjaikban); a nyilvános naptárban csak akkor jelenik meg, ha a tulajdonos ezt külön engedi.
// A beállítás a settings gyűjtemény global_settings dokumentumának "occupancy" mezője.
import { STORE_NAMES } from '@/lib/permissions';

export const STORE_IDS = Object.keys(STORE_NAMES);

export function normalizeOccupancy(raw) {
  const capacity = {};
  for (const id of STORE_IDS) {
    const n = Number(raw?.capacity?.[id]);
    capacity[id] = Number.isInteger(n) && n > 0 ? n : null;
  }
  return { enabled: raw?.enabled === true, public: raw?.public === true, capacity };
}

// Az esemény napja ("2026-10-30"): az időpontok magyar helyi időben, "ÉÉÉÉ-HH-NNTÓÓ:PP" alakban vannak tárolva
export const eventDay = (evt) => String(evt?.date || '').slice(0, 10);

// Hány helyet foglal egy esemény: a jelentkezők száma; a kötetlen létszámú és a külső jelentkezésű esemény nem számít bele
// (kivéve a Riftbound-eseményt, aminek a létszámát szinkronizáljuk)
export function eventSeats(evt) {
  if (!evt || evt.isOpenAttendance) return 0;
  if (evt.external_url && !evt.rgn?.syncedAt) return 0;
  const n = Number(evt.current_players);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Egy bolt egy napjának telítettsége. bookedSeats: a kézi foglalások helyeinek összege (a nyilvános adatban csak ez van meg)
export function dayOccupancy({ store, day, tournaments, bookings, bookedSeats, capacity }) {
  const cap = capacity?.[store] || null;
  const events = (tournaments || [])
    .filter(e => (e.store || 'debrecen') === store && eventDay(e) === day)
    .reduce((n, e) => n + eventSeats(e), 0);
  const manual = typeof bookedSeats === 'number'
    ? bookedSeats
    : (bookings || []).filter(b => b.store === store && b.date === day).reduce((n, b) => n + (b.seats || 0), 0);
  const used = events + manual;
  return {
    events, manual, used, cap,
    free: cap ? Math.max(0, cap - used) : null,
    pct: cap ? Math.round((used / cap) * 100) : null,
    over: cap ? used > cap : false,
  };
}

// --- Kézi helyfoglalás ellenőrzése (szerveroldalon) ---
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// Visszaad: { booking } vagy { error }
export function sanitizeBooking(input) {
  const store = String(input?.store || '');
  if (!STORE_IDS.includes(store)) return { error: 'Ismeretlen bolt.' };
  const date = String(input?.date || '');
  if (!DAY_RE.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`))) return { error: 'Hibás nap.' };
  const from = String(input?.from || '');
  const to = String(input?.to || '');
  if (!TIME_RE.test(from) || !TIME_RE.test(to)) return { error: 'Az időpontot ÓÓ:PP alakban add meg.' };
  if (from >= to) return { error: 'A foglalás vége legyen a kezdése után.' };
  const seats = Number(input?.seats);
  if (!Number.isInteger(seats) || seats < 1 || seats > 500) return { error: 'A helyek száma 1 és 500 között legyen.' };
  const label = String(input?.label || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!label) return { error: 'Add meg, kinek vagy mire szól a foglalás.' };
  return { booking: { store, date, from, to, seats, label } };
}

// A nyilvános naptárba: boltonként és naponként a kézi foglalások helyeinek összege, név nélkül ({ "debrecen|2026-10-30": 6 })
export function publicBookedSeats(bookings) {
  const out = {};
  for (const b of bookings || []) {
    const key = `${b.store}|${b.date}`;
    out[key] = (out[key] || 0) + (b.seats || 0);
  }
  return out;
}
