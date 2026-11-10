// A boltok neve és címe a Google-jelöléshez (schema.org Event az eseményoldalon). A címek a weboldal eredeti
// tartalmából valók (weblap/lib/content.js, Boltok fül); ha egy bolt költözik, itt is át kell írni.
export const STORE_INFO = {
  debrecen: { name: 'Tavern Debrecen', streetAddress: 'Gambrinus köz', addressLocality: 'Debrecen', postalCode: '' },
  jatekceh: { name: 'JátékCéh', streetAddress: 'Batthyány u. 1', addressLocality: 'Debrecen', postalCode: '4024' },
  miskolc: { name: 'Tavern Miskolc', streetAddress: 'Nagy Imre u. 17', addressLocality: 'Miskolc', postalCode: '3525' },
};

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://taverncalendar.vercel.app';

// A magyar időzóna eltolása órában egy adott pillanatban (+1 télen, +2 nyáron)
function offsetAt(utcMs) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Budapest', timeZoneName: 'shortOffset' })
    .formatToParts(new Date(utcMs)).find(p => p.type === 'timeZoneName')?.value || 'GMT+1';
  return Number((name.match(/GMT([+-]\d+)/) || [])[1] || 1);
}
const two = (n) => String(n).padStart(2, '0');
const isoAt = (utcMs) => {
  const off = offsetAt(utcMs);
  const d = new Date(utcMs + off * 3600000);
  return `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())}T${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:00${off < 0 ? '-' : '+'}${two(Math.abs(off))}:00`;
};

// "2026-11-11T17:30" (magyar helyi idő) → "2026-11-11T17:30:00+01:00" (nyári időszámításban +02:00).
// A régi, időzónás dátumokat (pl. "…Z") a pontos pillanatuk szerint váltja át. Hibás dátumra null.
export function budapestIso(local) {
  const str = String(local || '');
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  if (!m) {
    if (!/(Z|[+-]\d{2}:?\d{2})$/.test(str)) return null;
    const t = new Date(str).getTime();
    return Number.isNaN(t) ? null : isoAt(t);
  }
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(naive);
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d || check.getUTCHours() !== h || check.getUTCMinutes() !== mi) return null;
  // A helyi időhöz tartozó pillanat: az eltolást kétszer igazítjuk (az időzóna-váltás napjának hajnalán is pontos)
  let utc = naive - offsetAt(naive) * 3600000;
  utc = naive - offsetAt(utc) * 3600000;
  return isoAt(utc);
}

// Az eseményoldal Google-jelölése (https://schema.org/Event)
export function eventJsonLd(event, id) {
  const store = STORE_INFO[event.store || 'debrecen'] || STORE_INFO.debrecen;
  const start = budapestIso(event.date);
  if (!start) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.name,
    startDate: start,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: store.name,
      address: { '@type': 'PostalAddress', streetAddress: store.streetAddress, addressLocality: store.addressLocality, ...(store.postalCode ? { postalCode: store.postalCode } : {}), addressCountry: 'HU' },
    },
    organizer: { '@type': 'Organization', name: 'Tavern', url: SITE_URL },
    url: `${SITE_URL}/esemeny/${encodeURIComponent(id)}`,
    ...(event.description ? { description: String(event.description).slice(0, 500) } : {}),
    ...(event.category ? { about: event.category } : {}),
  };
}
