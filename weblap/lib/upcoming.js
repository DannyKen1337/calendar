// A weboldal heti programjának adata (csak a szerveren: a naptár gyorsítótárazott adatát olvassa, lib/publicCalendar.js)
import { getPublicCalendarData } from '@/lib/publicCalendar';
import { budapestNow, dayOf } from '@/weblap/lib/calendar';

// A boltok közelgő (mai és későbbi) eseményei időrendben; stores: mely boltoké (alapból csak Debrecen, a korábbi egyboltos oldalhoz).
// Hiba esetén üres lista (az oldal akkor is megjelenik).
export async function getUpcomingEvents(stores = ['debrecen']) {
  try {
    // ugyanaz az adat, mint a nyilvános naptáré (lib/publicCalendar.js, gyorsítótárazva; minden írás azonnal frissíti)
    const data = await getPublicCalendarData();
    const today = budapestNow().day;
    const events = (data.tournaments || [])
      .filter(e => stores.includes(e.store || 'debrecen'))
      // A ma kezdődött eseményeket a nap végéig mutatjuk (egy délutáni verseny este még "ma este" van)
      .filter(e => dayOf(e.date) >= today)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return { events, ok: true };
  } catch {
    return { events: [], ok: false };
  }
}
