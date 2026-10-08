// Esemény típusok. A 'tournament' (verseny) az alapértelmezett – a régi eseményeknél nincs eventType mező.
// A különleges típusok (szett megjelenés, expo, egyéb különleges esemény) feltűnőbb, saját megjelenést kapnak:
// color: keret és fény színe; gradient: a naptársáv és a címke háttere (90°, az első és utolsó szín azonos, így animálható).

export const EVENT_TYPES = {
  tournament: { label: 'Verseny', short: 'Verseny', icon: '' },
  release: { label: 'Szett megjelenés', short: 'Megjelenés', icon: '🚀', color: '#22d3ee', gradient: 'linear-gradient(90deg, #0e7490 0%, #7c3aed 50%, #0e7490 100%)' },
  expo: { label: 'Expo', short: 'Expo', icon: '🎪', color: '#f472b6', gradient: 'linear-gradient(90deg, #be185d 0%, #ea580c 50%, #be185d 100%)' },
  special: { label: 'Különleges esemény', short: 'Különleges', icon: '✨', color: '#facc15', gradient: 'linear-gradient(90deg, #a16207 0%, #15803d 50%, #a16207 100%)' },
};

export const sanitizeEventType = (value) => (Object.hasOwn(EVENT_TYPES, value) ? value : 'tournament');
export const getEventType = (evt) => sanitizeEventType(evt?.eventType);
export const getEventTypeConfig = (evt) => EVENT_TYPES[getEventType(evt)];
export const isSpecialEvent = (evt) => getEventType(evt) !== 'tournament';
