// Ismétlődő események (sorozatok), kliens- és szerveroldalon is használható logika.
// A generátor egy generálás minden alkalmának közös azonosítót ad (seriesId). A korábban, azonosító nélkül generált
// eseményeket a név, a bolt, a játék, a hét napja és a kezdési időpont alapján ismerjük fel sorozatként.
// Tömeges szerkesztésnél csak a jövőbeli (ma vagy később kezdődő) alkalmak módosulnak.

export const SERIES_ID_RE = /^[A-Za-z0-9-]{8,64}$/;

// Ezek a mezők vihetők át a sorozat többi alkalmára; a nap és a külső link alkalmanként marad
export const SERIES_FIELDS = ['name', 'category', 'store', 'max_players', 'isOpenAttendance', 'description', 'isFeatured', 'decklistEnabled', 'eventType', 'hosts', 'color'];

const dayOf = (d) => String(d || '').slice(0, 10);
const timeOf = (d) => String(d || '').slice(11, 16);
const weekdayOf = (d) => new Date(`${dayOf(d)}T12:00:00Z`).getUTCDay();

// Ugyanahhoz a sorozathoz tartozik-e a két esemény
export function sameSeries(a, b) {
  if (a.seriesId || b.seriesId) return !!a.seriesId && a.seriesId === b.seriesId;
  return a.name === b.name
    && (a.store || 'debrecen') === (b.store || 'debrecen')
    && a.category === b.category
    && weekdayOf(a.date) === weekdayOf(b.date)
    && timeOf(a.date) === timeOf(b.date);
}

// A sorozat jövőbeli alkalmai időrendben (az adott eseménnyel együtt).
// scope: 'following' = ettől az alkalomtól kezdve, 'all' = minden jövőbeli alkalom. today: "YYYY-MM-DD" (Budapest)
export function seriesMembers(events, anchor, scope, today) {
  const from = scope === 'following' ? String(anchor.date) : today;
  return events
    .filter(e => dayOf(e.date) >= today && String(e.date) >= from && sameSeries(anchor, e))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

// Mi változott az eredeti eseményhez képest (csak a sorozatra átvihető mezők), és változott-e a kezdési időpont
export function seriesChanges(original, updated) {
  const norm = (k, v) => {
    if (k === 'hosts') return JSON.stringify([...(v || [])].map(String).sort());
    if (k === 'isOpenAttendance' || k === 'isFeatured' || k === 'decklistEnabled') return !!v;
    if (k === 'max_players') return Number(v) || 0;
    if (k === 'store') return v || 'debrecen';
    return v ?? '';
  };
  const changes = {};
  for (const k of SERIES_FIELDS) {
    if (updated[k] !== undefined && norm(k, updated[k]) !== norm(k, original[k])) changes[k] = updated[k];
  }
  const time = timeOf(updated.date) && timeOf(updated.date) !== timeOf(original.date) ? timeOf(updated.date) : null;
  return { changes, time };
}
