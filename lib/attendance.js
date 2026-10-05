// Létszám értelmezése mentéskor.
// - a "Kötetlen létszám" jelölőnégyzet VAGY a Max Létszám mezőbe írt 0 => kötetlen esemény (nincs max, nincs jelentkezés)
// - üres / érvénytelen / negatív érték => alapértelmezett 16
export function resolveAttendance(rawMax, openChecked) {
  const text = rawMax === undefined || rawMax === null ? '' : String(rawMax).trim();
  const typedZero = text !== '' && Number(text) === 0;
  const isOpenAttendance = !!openChecked || typedZero;
  const parsed = parseInt(text, 10);
  const max_players = isOpenAttendance ? 0 : (Number.isFinite(parsed) && parsed > 0 ? parsed : 16);
  return { isOpenAttendance, max_players };
}
// Nyilvános megjelenítés: Vezetéknév + a keresztnév kezdőbetűje (pl. "Teszt Elek" => "Teszt E.")
export function shortName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const capitalize = (w) => { const [first, ...rest] = Array.from(w); return first.toLocaleUpperCase('hu-HU') + rest.join(''); };
  const surname = capitalize(parts[0]);
  if (parts.length === 1) return surname;
  return `${surname} ${Array.from(parts[1])[0].toLocaleUpperCase('hu-HU')}.`;
}

// Az eseményekhez csatolja a jelentkezők rövidített nevét (e-mail és teljes név nélkül), jelentkezési sorrendben
export function attachPublicAttendees(tournaments, registrations) {
  const byEvent = new Map();
  [...(registrations || [])]
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
    .forEach(reg => {
      const key = String(reg.tournamentId);
      if (!byEvent.has(key)) byEvent.set(key, []);
      const name = shortName(reg.name);
      if (name) byEvent.get(key).push({ name, queue: !(reg.status === 'Aktív' || reg.status === 'Active') });
    });
  return (tournaments || []).map(t => ({ ...t, attendees: byEvent.get(String(t._id || t.id)) || [] }));
}
