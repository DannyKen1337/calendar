// A Tavern naptár (taverncalendar.vercel.app) nyilvános adatai: a debreceni bolt közelgő eseményei.
// A lekérést a szerver 5 percig gyorsítótárazza, így a naptárba felvett új esemény néhány percen belül itt is megjelenik.
// Minden időpont magyar helyi idő ("2026-10-28T16:00", időzóna nélkül), a "most" Europe/Budapest szerint értendő.

export const CALENDAR_URL = process.env.CALENDAR_URL || 'https://taverncalendar.vercel.app';

// A naptár játékai rövid névvel és színnel (a naptár saját színei)
export const GAMES = {
  'Pokémon TCG': { short: 'Pokémon', color: '#eab308', img: 'pokemon' },
  'One Piece Card Game': { short: 'One Piece', color: '#8b5cf6', img: 'one-piece' },
  'Riftbound': { short: 'Riftbound', color: '#1d4ed8', img: 'riftbound' },
  'Magic: The Gathering': { short: 'Magic', color: '#b91c1c', img: 'magic' },
  'Warhammer': { short: 'Warhammer', color: '#166534', img: 'warhammer' },
  'CyberPunk TCG': { short: 'CyberPunk', color: '#10b981', img: 'cyberpunk' },
  'Yu-Gi-Oh!': { short: 'Yu-Gi-Oh!', color: '#14b8c4', img: 'yugioh' },
  'Disney Lorcana': { short: 'Lorcana', color: '#f97316', img: 'lorcana' },
  'Flesh and Blood': { short: 'Flesh and Blood', color: '#ec4899', img: 'flesh-and-blood' },
};
export const gameShort = (c) => GAMES[c]?.short || c || 'Egyéb';
export const gameColor = (c) => GAMES[c]?.color || '#8a7f80';
// A játék képe a programhoz (ideiglenes rajzok a public/rajz/jatekok mappában)
export const gameImage = (c) => `/rajz/jatekok/${GAMES[c]?.img || 'egyeb'}.jpg`;

// Nyitvatartás (0 = vasárnap ... 6 = szombat), a naptár beállításaival egyezően
export const HOURS = { 0: ['11:00', '20:00'], 1: null, 2: null, 3: ['15:00', '21:00'], 4: ['15:00', '21:00'], 5: ['15:00', '21:00'], 6: ['10:00', '21:00'] };
export const DAY_NAMES = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat'];
export const ON_DAY = ['vasárnap', 'hétfőn', 'kedden', 'szerdán', 'csütörtökön', 'pénteken', 'szombaton'];
const MONTHS = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];

// A Budapest szerinti "most": { day: "2026-10-25", time: "21:30", weekday: 0 }
export function budapestNow(ms = Date.now()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
  }).formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, weekday };
}

export const addDays = (day, n) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const weekdayOf = (day) => new Date(`${day}T12:00:00Z`).getUTCDay();
// "10. 26." (a napválasztó füleihez)
export const numericDay = (day) => { const [, m, d] = day.split('-'); return `${m}. ${d}.`; };
export const formatDay = (day) => { const [, m, d] = day.split('-').map(Number); return `${MONTHS[m - 1]} ${d}.`; };
export const timeOf = (date) => String(date).slice(11, 16);
export const dayOf = (date) => String(date).slice(0, 10);

// Nyitva van-e most, és mikor nyit / zár. Visszaad: { open, text }
export function openStatus(now = budapestNow()) {
  const today = HOURS[now.weekday];
  if (today && now.time >= today[0] && now.time < today[1]) return { open: true, text: `Most nyitva, ${today[1]}-ig` };
  if (today && now.time < today[0]) return { open: false, text: `Ma ${today[0]}-kor nyitunk` };
  for (let i = 1; i <= 7; i++) {
    const wd = (now.weekday + i) % 7;
    if (HOURS[wd]) return { open: false, text: `Zárva, ${i === 1 ? 'holnap' : ON_DAY[wd]} ${HOURS[wd][0]}-kor nyitunk` };
  }
  return { open: false, text: 'Zárva' };
}

// Szabad helyek szövege
export function spotsText(e) {
  if (e.isOpenAttendance || !e.max_players) return 'Kötetlen részvétel';
  const cur = e.current_players || 0;
  return cur >= e.max_players ? `Betelt (${e.max_players} fő)` : `${cur} / ${e.max_players} hely`;
}

export const LEAGUES_URL = `${CALENDAR_URL}/liga`;
export const PREORDER_URL = `${CALENDAR_URL}/elorendeles`;

export const eventUrl = (e) => `${CALENDAR_URL}/esemeny/${encodeURIComponent(e._id || e.id)}`;

// A boltok közelgő (mai és későbbi) eseményei időrendben; stores: mely boltoké (alapból csak Debrecen, a korábbi egyboltos oldalhoz).
// Hiba esetén üres lista (az oldal akkor is megjelenik).
export async function getUpcomingEvents(stores = ['debrecen']) {
  try {
    const res = await fetch(`${CALENDAR_URL}/api/public-data`, { next: { revalidate: 300 } });
    if (!res.ok) return { events: [], ok: false };
    const data = await res.json();
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
