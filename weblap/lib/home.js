// A közös (háromboltos) kezdőlap adatai, mindhárom tervhez ugyanaz.
import { getUpcomingEvents, budapestNow } from '@/weblap/lib/calendar';
import { STORES, storeStatus, weekByStore } from '@/weblap/lib/stores';

export async function getHomeData() {
  const { events, ok } = await getUpcomingEvents(STORES.map(s => s.id));
  const now = budapestNow();
  const week = weekByStore(events, now);
  const stores = STORES.map(s => ({
    ...s,
    status: storeStatus(s, now),
    upcoming: events.filter(e => (e.store || 'debrecen') === s.id),
  }));
  return { ok, events, now, week, stores, featured: events.find(e => e.isFeatured) || null };
}
