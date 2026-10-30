// A főoldal adatai: a boltok (a tartalomból, a naptár közelgő eseményeivel és a mostani nyitva / zárva állapottal)
// és a következő hét nap programja boltonként.
import { getUpcomingEvents, budapestNow } from '@/weblap/lib/calendar';
import { storeStatus, weekByStore } from '@/weblap/lib/stores';
import { STORE_IDS } from '@/weblap/lib/contentSchema';

export async function getHomeData(content) {
  const { events, ok } = await getUpcomingEvents(STORE_IDS);
  const now = budapestNow();
  const week = weekByStore(events, STORE_IDS, now);
  const stores = STORE_IDS.map(id => {
    const st = content.stores[id];
    return {
      id,
      ...st,
      city: st.address.split(',')[0].trim(),
      status: storeStatus(st, now),
      upcoming: events.filter(e => (e.store || 'debrecen') === id),
    };
  });
  return { ok, events, now, week, stores, featured: events.find(e => e.isFeatured) || null };
}
