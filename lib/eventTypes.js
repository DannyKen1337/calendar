// Esemény típusok. A 'tournament' (verseny) az alapértelmezett – a régi eseményeknél nincs eventType mező.
// A különleges típusok (szett megjelenés, expo, egyéb különleges esemény) feltűnőbb, saját megjelenést kapnak:
// color: keret és fény színe; gradient: a naptársáv és a címke háttere (90°, az első és utolsó szín azonos, így animálható).
// icon: üres (emoji ikon nem kell, a típust a felirat és a szín jelzi); a mező a régi hivatkozások miatt maradt.

export const EVENT_TYPES = {
  tournament: { label: 'Verseny', short: 'Verseny', icon: '' },
  release: { label: 'Szett megjelenés', short: 'Megjelenés', icon: '', color: '#22d3ee', gradient: 'linear-gradient(90deg, #0e7490 0%, #7c3aed 50%, #0e7490 100%)' },
  expo: { label: 'Expo', short: 'Expo', icon: '', color: '#f472b6', gradient: 'linear-gradient(90deg, #be185d 0%, #ea580c 50%, #be185d 100%)' },
  special: { label: 'Különleges esemény', short: 'Különleges', icon: '', color: '#facc15', gradient: 'linear-gradient(90deg, #a16207 0%, #15803d 50%, #a16207 100%)' },
  // Közösségi esemény (pl. Pokeween): nincs jelentkezés, de a megadott számú helyet lefoglalja a bolt napi telítettségéből
  community: { label: 'Közösségi esemény', short: 'Közösségi', icon: '', color: '#34d399', gradient: 'linear-gradient(90deg, #047857 0%, #0e7490 50%, #047857 100%)' },
};

export const sanitizeEventType = (value) => (Object.hasOwn(EVENT_TYPES, value) ? value : 'tournament');
export const getEventType = (evt) => sanitizeEventType(evt?.eventType);
export const getEventTypeConfig = (evt) => EVENT_TYPES[getEventType(evt)];
export const isSpecialEvent = (evt) => getEventType(evt) !== 'tournament';
export const isCommunityEvent = (evt) => getEventType(evt) === 'community';

// A közösségi esemény lefoglalt helyeinek ellenőrzése: 1–500 közötti egész, különben null
export const RESERVED_SEATS_MAX = 500;
export function sanitizeReservedSeats(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= RESERVED_SEATS_MAX ? n : null;
}

// Decklist jelölés: csak azoknál az eseményeknél látszik, ahol be van kapcsolva (decklistEnabled),
// vagy ahol korábban már jelöltek valamit (a bekapcsolható beállítás előtti események adatai ne vesszenek el)
export const showsDecklist = (evt, registrations) =>
  !!evt?.decklistEnabled || (registrations || []).some(r => r.decklist === true || r.decklist === false);
