// Esemény-időpontok kezelése a gép órájától és időzónájától függetlenül.
// Az események időpontja magyar helyi idő szövegként van tárolva ("2026-10-05T18:00", időzóna nélkül).
// A "most" mindig a szerver órája szerint, Europe/Budapest időzónában értendő.

const pad = (n) => String(n).padStart(2, '0');
const NAIVE_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/;

// Egy időpont (epoch ms) Budapest szerinti helyi ideje "YYYY-MM-DDTHH:mm" formában
export function budapestDateTime(epochMs) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(epochMs)).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

// Naptári nap hozzáadása egy "YYYY-MM-DD" dátumhoz (időzóna és nyári időszámítás nem befolyásolja)
export function addDays(dateStr, days) {
  const m = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + days));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// Beérkező esemény-időpont egységesítése "YYYY-MM-DDTHH:mm" formára.
// Időzóna nélküli szöveg: változatlanul (magyar helyi időként) marad; időzónás (pl. "...Z") időpont: átszámítjuk magyar időre.
// null, ha érvénytelen.
export function normalizeEventDate(value) {
  const s = String(value ?? '').trim();
  const m = s.match(NAIVE_RE);
  if (m) {
    const [, y, mo, d, h, mi] = m.map(Number);
    const check = new Date(Date.UTC(y, mo - 1, d, h, mi));
    if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d || h > 23 || mi > 59) return null;
    return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`;
  }
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) {
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : budapestDateTime(t);
  }
  return null;
}
