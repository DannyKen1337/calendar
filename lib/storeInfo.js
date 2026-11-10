// A boltok neve és címe a Google-jelöléshez (schema.org Event az eseményoldalon). A címek a weboldal eredeti
// tartalmából valók (weblap/lib/content.js, Boltok fül); ha egy bolt költözik, itt is át kell írni.
export const STORE_INFO = {
  debrecen: { name: 'Tavern Debrecen', streetAddress: 'Gambrinus köz', addressLocality: 'Debrecen', postalCode: '' },
  jatekceh: { name: 'JátékCéh', streetAddress: 'Batthyány u. 1', addressLocality: 'Debrecen', postalCode: '4024' },
  miskolc: { name: 'Tavern Miskolc', streetAddress: 'Nagy Imre u. 17', addressLocality: 'Miskolc', postalCode: '3525' },
};

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://taverncalendar.vercel.app';

// "2026-11-11T17:30" (magyar helyi idő) → "2026-11-11T17:30:00+01:00" (nyári időszámításban +02:00)
export function budapestIso(local) {
  const m = String(local || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  // A nap délben UTC-ben: ebből a magyar időzóna eltolása (a váltás hajnalban van, délben már biztos)
  const name = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Budapest', timeZoneName: 'shortOffset' })
    .formatToParts(new Date(Date.UTC(+y, +mo - 1, +d, 12))).find(p => p.type === 'timeZoneName')?.value || 'GMT+1';
  const hours = Number((name.match(/GMT([+-]\d+)/) || [])[1] || 1);
  const sign = hours < 0 ? '-' : '+';
  return `${y}-${mo}-${d}T${h}:${mi}:00${sign}${String(Math.abs(hours)).padStart(2, '0')}:00`;
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
