// A három bolt adatai a közös oldalhoz. A naptárban a boltok azonosítója: debrecen (Tavern Debrecen), jatekceh (JátékCéh), miskolc (Tavern Miskolc).
// A nevek és címek a tulajdonos megadása szerint (a Tavern Debrecen házszáma nincs megadva).
import { budapestNow, addDays, weekdayOf, dayOf, ON_DAY, DAY_NAMES } from '@/weblap/lib/calendar';

export const STORES = [
  {
    id: 'debrecen',
    name: 'Tavern Debrecen',
    city: 'Debrecen',
    address: 'Debrecen, Gambrinus köz',
    where: 'A Gambrinus közben, a Kossuth utcától pár lépésre',
    about: 'A klub: versenyek, ligaestek, terepasztalos csaták és esti társasozás.',
    hours: { 0: ['11:00', '20:00'], 1: null, 2: null, 3: ['15:00', '21:00'], 4: ['15:00', '21:00'], 5: ['15:00', '21:00'], 6: ['10:00', '21:00'] },
    maps: 'https://maps.app.goo.gl/uKFkdGwHk3vYQCmZ8',
    photo: { src: '/photos/bolt-asztalok.png', alt: 'Teli asztalok egy esti versenyen a Tavern Debrecenben, a háttérben a bolt polcai', position: '50% 40%' },
  },
  {
    id: 'jatekceh',
    name: 'JátékCéh',
    city: 'Debrecen',
    address: 'Debrecen, Batthyány u. 1, 4024',
    where: 'A Batthyány utca elején, a Kossuth utca sarkán',
    about: 'Bolt a belvárosban: kártyák, társasok és kiegészítők, hétvégén játékkal.',
    hours: { 0: null, 1: ['12:00', '18:00'], 2: ['12:00', '18:00'], 3: null, 4: null, 5: ['14:00', '20:00'], 6: ['10:00', '21:00'] },
    maps: 'https://www.google.com/maps/search/?api=1&query=Debrecen%2C+Batthy%C3%A1ny+u.+1%2C+4024',
    // A Kossuth utca archív fotója (Fortepan, CC BY-SA 3.0, a forrás a láblécben): a bolt ennek a sarkán van
    photo: { src: '/images/kossuth-utca-fortepan.png', alt: 'A debreceni Kossuth utca egy régi fekete-fehér fotón, a Piac utca felé nézve', position: '70% 75%', archive: true },
  },
  {
    id: 'miskolc',
    name: 'Tavern Miskolc',
    city: 'Miskolc',
    address: 'Miskolc, Nagy Imre u. 17 - Földszint 4, 3525',
    where: 'A Nagy Imre utcában, a földszinten',
    about: 'A miskolci Tavern: versenyek és klubnapok minden héten.',
    hours: { 0: ['11:00', '20:00'], 1: null, 2: null, 3: ['15:00', '21:00'], 4: ['15:00', '21:00'], 5: ['15:00', '21:00'], 6: ['10:00', '21:00'] },
    maps: 'https://www.google.com/maps/search/?api=1&query=Miskolc%2C+Nagy+Imre+u.+17%2C+3525',
    // Ideiglenes, rajzolt kép, amíg nincs fotó a boltról
    photo: { src: '/rajz/miskolc-bolt.jpg', alt: 'Rajz: esti utcafront kivilágított kirakattal és a Tavern cégérével a bejárat fölött', position: '40% 60%' },
  },
];
export const storeById = (id) => STORES.find(s => s.id === id) || STORES[0];

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
export function weekByStore(events, now = budapestNow()) {
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(now.day, i);
    const list = events.filter(e => dayOf(e.date) === day);
    return { day, wd: weekdayOf(day), offset: i, events: Object.fromEntries(STORES.map(s => [s.id, list.filter(e => (e.store || 'debrecen') === s.id)])) };
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
