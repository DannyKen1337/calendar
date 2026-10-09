// Boltok nyitvatartása (a hét napja: 0 = vasárnap ... 6 = szombat; [nyitás, zárás] "ÓÓ:PP"; null = zárva).
// Ha egy boltnak nincs megadva nyitvatartás (pl. Tavern Miskolc), nem ellenőrizzük.
export const STORE_HOURS = {
  debrecen: {
    0: ['11:00', '20:00'],
    1: null,
    2: null,
    3: ['15:00', '21:00'],
    4: ['15:00', '21:00'],
    5: ['15:00', '21:00'],
    6: ['10:00', '21:00'],
  },
  jatekceh: {
    0: null,
    1: ['12:00', '18:00'],
    2: ['12:00', '18:00'],
    3: null,
    4: null,
    5: ['14:00', '20:00'],
    6: ['10:00', '21:00'],
  },
  // miskolc: még nincs megadva
};

// Az esemény leghamarabb ennyivel nyitás után kezdődhet (hogy legyen idő előkészülni)
export const MIN_MINUTES_AFTER_OPENING = 30;

const DAY_NAMES = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
const ON_DAY = ['vasárnap', 'hétfőn', 'kedden', 'szerdán', 'csütörtökön', 'pénteken', 'szombaton'];
const toMinutes = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const fromMinutes = (mins) => `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;

// Figyelmeztetés, ha az esemény a bolt nyitvatartásán kívül vagy túl korán (nyitás + 30 perc előtt) kezdődik.
// A dátum magyar helyi idő szövegként ("2026-10-05T18:00"). Visszaad: figyelmeztető szöveg vagy null.
// A bolt nélküli (régi) események Debrecenhez tartoznak.
export function getOpeningHoursWarning(store, dateStr) {
  const hours = STORE_HOURS[store || 'debrecen'];
  const m = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!hours || !m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const weekday = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  const day = hours[weekday];
  if (!day) return `A bolt ${ON_DAY[weekday]} zárva van.`;

  const start = h * 60 + mi;
  const open = toMinutes(day[0]);
  const close = toMinutes(day[1]);
  const earliest = open + MIN_MINUTES_AFTER_OPENING;
  if (start < open) return `Az esemény nyitás előtt kezdődik (${DAY_NAMES[weekday]}i nyitvatartás: ${day[0]}–${day[1]}). Leghamarabb ${fromMinutes(earliest)}-kor érdemes kezdeni.`;
  if (start < earliest) return `Az esemény a nyitás után kevesebb mint ${MIN_MINUTES_AFTER_OPENING} perccel kezdődik (${DAY_NAMES[weekday]}i nyitás: ${day[0]}). Leghamarabb ${fromMinutes(earliest)}-kor érdemes kezdeni.`;
  if (start >= close) return `Az esemény zárás után kezdődik (${DAY_NAMES[weekday]}i zárás: ${day[1]}).`;
  return null;
}
