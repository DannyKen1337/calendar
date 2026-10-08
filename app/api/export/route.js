import { getTavernDb } from '@/lib/mongodb';
import { isSpecialEvent, getEventTypeConfig } from '@/lib/eventTypes';

export const dynamic = 'force-dynamic';

const STORE_LOCATIONS = {
  debrecen: 'Tavern, Kossuth utca 7, Debrecen',
  miskolc: 'Tavern Miskolc',
  jatekceh: 'JátékCéh',
};

const EVENT_LENGTH_HOURS = 3; // Feltételezzük, hogy egy verseny átlagosan 3 órás

// Az események dátuma magyar helyi idő ("2026-10-05T18:00", időzóna nélkül), ezért Europe/Budapest időzónával exportáljuk.
// (A Vercel szervere UTC-ben fut: ha new Date()-tel értelmeznénk, az idő 1-2 órával eltolódna.)
const VTIMEZONE = [
  'BEGIN:VTIMEZONE', 'TZID:Europe/Budapest',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
  'END:VTIMEZONE',
];

const pad = (n) => String(n).padStart(2, '0');
const formatUtc = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
// A dátum mezőit "naiv" (időzóna nélküli) időként kezeljük, a Date.UTC csak a számoláshoz kell
const formatLocal = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00`;

function eventTimes(dateStr) {
  const m = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/);
  if (m) {
    const [, y, mo, d, h, mi] = m.map(Number);
    const start = new Date(Date.UTC(y, mo - 1, d, h, mi));
    const end = new Date(start.getTime() + EVENT_LENGTH_HOURS * 3600 * 1000);
    return { start: `;TZID=Europe/Budapest:${formatLocal(start)}`, end: `;TZID=Europe/Budapest:${formatLocal(end)}` };
  }
  // Régi, időzónás (pl. ISO "Z") dátumok
  const start = new Date(dateStr);
  if (isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + EVENT_LENGTH_HOURS * 3600 * 1000);
  return { start: `:${formatUtc(start)}`, end: `:${formatUtc(end)}` };
}

const escapeText = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// RFC 5545: a sorok legfeljebb 75 bájtosak lehetnek, a folytatósor szóközzel kezdődik
function foldLine(line) {
  const encoder = new TextEncoder();
  let out = '';
  let bytes = 0;
  for (const ch of line) {
    const len = encoder.encode(ch).length;
    if (bytes + len > 75) { out += '\r\n '; bytes = 1; }
    out += ch;
    bytes += len;
  }
  return out;
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const categoriesParam = url.searchParams.get('categories');
    const store = url.searchParams.get('store');

    const query = {};
    if (categoriesParam) query.category = { $in: categoriesParam.split(',') };
    // A bolt nélküli (régi) események Debrecenhez tartoznak
    if (store && STORE_LOCATIONS[store]) {
      query.store = store === 'debrecen' ? { $in: ['debrecen', null, ''] } : store;
    }

    const db = await getTavernDb();
    const events = await db.collection('tournaments').find(query).toArray();

    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tavern//Naptar//HU', 'CALSCALE:GREGORIAN', ...VTIMEZONE];
    const stamp = formatUtc(new Date());

    events.forEach(event => {
      const times = eventTimes(event.date);
      if (!times) return; // hibás dátumú esemény ne törje el az egész exportot
      lines.push(
        'BEGIN:VEVENT',
        `UID:${event._id}@tavern.hu`,
        `DTSTAMP:${stamp}`,
        `DTSTART${times.start}`,
        `DTEND${times.end}`,
        `SUMMARY:${escapeText(`${isSpecialEvent(event) ? `${getEventTypeConfig(event).label}: ` : ''}${event.name} (${event.category})`)}`,
        `DESCRIPTION:${escapeText(event.description)}`,
        `LOCATION:${escapeText(STORE_LOCATIONS[event.store] || STORE_LOCATIONS.debrecen)}`,
        'END:VEVENT',
      );
    });

    lines.push('END:VCALENDAR');

    return new Response(lines.map(foldLine).join('\r\n') + '\r\n', {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="tavern_versenyek.ics"'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Az exportálás nem sikerült.' }), { status: 500 });
  }
}
