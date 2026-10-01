// Ékezet- és kisbetű-érzéketlen keresés az eseményekben (név, játék, leírás). Több szó esetén mindegyiknek szerepelnie kell.
const normalize = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export function eventMatchesQuery(evt, query, extraText = '') {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = normalize([evt?.name, evt?.category, evt?.description, extraText].join(' '));
  return tokens.every((token) => haystack.includes(token));
}

const HU_MONTHS = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];

// Admin lista: helyszín, dátum (2026-10-05 / 2026.10.05 / 10.05 / október), idő, állapot és kiemelés is kereshető
export function eventExtraSearchText(evt, storeName = '') {
  const parts = [storeName, evt?.is_open ? 'nyitott' : 'lezárva', evt?.isFeatured ? 'kiemelt' : ''];
  const m = String(evt?.date || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?/);
  if (m) {
    const [, y, mo, d, t] = m;
    parts.push(`${y}-${mo}-${d}`, `${y}.${mo}.${d}`, `${mo}.${d}`, HU_MONTHS[Number(mo) - 1] || '', t || '');
  }
  return parts.join(' ');
}
