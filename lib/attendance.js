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