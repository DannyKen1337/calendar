// Egy esemény feltételezett hossza (az iCal export is ezzel számol)
export const EVENT_LENGTH_HOURS = 3;

const eventId = (evt) => String(evt?._id || evt?.id || '');

// Szervezői ütközés: ugyanaz a szervező egy másik eseményt is tart, ami időben átfed ezzel
// (mindkét eseményt EVENT_LENGTH_HOURS hosszúnak tekintve). Visszaad: [{ hostId, event }]
export function findHostConflicts(events, { id, date, hosts }) {
  const start = new Date(date).getTime();
  const hostIds = (Array.isArray(hosts) ? hosts : []).map(String);
  if (!Number.isFinite(start) || hostIds.length === 0) return [];
  const windowMs = EVENT_LENGTH_HOURS * 3600 * 1000;
  const conflicts = [];
  (events || []).forEach(evt => {
    if (id && eventId(evt) === String(id)) return;
    const other = new Date(evt.date).getTime();
    if (!Number.isFinite(other) || Math.abs(other - start) >= windowMs) return;
    const otherHosts = (Array.isArray(evt.hosts) ? evt.hosts : []).map(String);
    hostIds.filter(h => otherHosts.includes(h)).forEach(hostId => conflicts.push({ hostId, event: evt }));
  });
  return conflicts;
}
