// A boltok nyitvatartásával és heti programjával kapcsolatos számítások. A boltok adatai (név, cím, nyitvatartás,
// fotó) a szerkeszthető tartalomban vannak (weblap/lib/content.js, Boltok fül); a naptárban a boltok azonosítója:
// debrecen (Tavern Debrecen), jatekceh (JátékCéh), miskolc (Tavern Miskolc).
import { budapestNow, addDays, weekdayOf, dayOf, ON_DAY, DAY_NAMES } from '@/weblap/lib/calendar';

// Nyitva van-e most az adott bolt. Visszaad: { open, text } (null, ha nincs megadva nyitvatartás)
export function storeStatus(store, now = budapestNow()) {
  const h = store.hours;
  if (!h) return null;
  const today = h[now.weekday];
  if (today && now.time >= today[0] && now.time < today[1]) return { open: true, text: `Nyitva ${today[1]}-ig` };
  if (today && now.time < today[0]) return { open: false, text: `Ma ${today[0]}-kor nyit` };
  for (let i = 1; i <= 7; i++) {
    const wd = (now.weekday + i) % 7;
    if (h[wd]) return { open: false, text: `${i === 1 ? 'Holnap' : ON_DAY[wd][0].toUpperCase() + ON_DAY[wd].slice(1)} ${h[wd][0]}-kor nyit` };
  }
  return { open: false, text: 'Zárva' };
}

// A következő hét nap boltonként: [{ day, wd, events: { debrecen: [...], jatekceh: [...], miskolc: [...] } }]
export function weekByStore(events, storeIds, now = budapestNow()) {
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(now.day, i);
    const list = events.filter(e => dayOf(e.date) === day);
    return { day, wd: weekdayOf(day), offset: i, events: Object.fromEntries(storeIds.map(id => [id, list.filter(e => (e.store || 'debrecen') === id)])) };
  });
}

export const HOURS_ORDER = [1, 2, 3, 4, 5, 6, 0];

// Összevont nyitvatartás: az egymást követő, azonos nyitvatartású napok egy sorban
// ([["Szerda–Péntek", "15:00–21:00"], ["Szombat", "10:00–21:00"], ...])
export function compactHours(hours) {
  if (!hours) return null;
  const runs = [];
  for (const wd of HOURS_ORDER) {
    const h = hours[wd];
    const last = runs[runs.length - 1];
    if (h && last && last.h.join() === h.join() && last.to === HOURS_ORDER[HOURS_ORDER.indexOf(wd) - 1]) last.to = wd;
    else if (h) runs.push({ from: wd, to: wd, h });
  }
  return runs.map(r => [`${DAY_NAMES[r.from]}${r.to !== r.from ? `–${DAY_NAMES[r.to]}` : ''}`, r.h.join('–')]);
}

// A zárt nap utáni első nyitás: "szerdán 15:00-kor" (null, ha nincs megadva nyitvatartás)
export function nextOpening(store, wd) {
  if (!store.hours) return null;
  for (let i = 1; i <= 7; i++) {
    const next = (wd + i) % 7;
    if (store.hours[next]) return `${i === 1 ? 'másnap' : ON_DAY[next]} ${store.hours[next][0]}-kor`;
  }
  return null;
}
