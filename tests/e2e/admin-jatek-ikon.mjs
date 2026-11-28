// Admin eseménylista: a játék logója. Telefonon (a felhasználó választása, C változat) a kártya bal oldalán egy oszlopban a
// logó és alatta az időpont, jobbra a teljes név, ami hosszú névnél sem vágódik le. Gépen a táblázatban a logó az időpont
// és az esemény neve között áll.
import { openDb, token, browser, page, ok, summary, SHOTS, BASE } from './lib.mjs';

const { client, db } = await openDb();
const owner = (await db.collection('users').insertOne({ username: 'Tulaj', email: 'o@x.hu', password: 'x', role: 'owner', lastSeenChangelog: '9999' })).insertedId;
const pad = (n) => String(n).padStart(2, '0');
const d = new Date();
const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const LONG = 'Riftbound Nexus Night: Spiritforged prerelease verseny';
await db.collection('tournaments').insertMany([
  { name: 'Pokémon klubnap', date: `${today}T23:30`, category: 'Pokémon TCG', store: 'debrecen', max_players: 16, current_players: 0, is_open: true, createdAt: new Date() },
  { name: 'One Piece bajnokság', date: `${today}T23:45`, category: 'One Piece Card Game', store: 'debrecen', max_players: 16, current_players: 0, is_open: true, createdAt: new Date() },
  { name: LONG, date: `${today}T23:50`, category: 'Riftbound', store: 'debrecen', max_players: 16, current_players: 0, is_open: true, createdAt: new Date() },
  { name: 'Társasjáték est', date: `${today}T23:55`, category: 'Egyéb', store: 'debrecen', max_players: 16, current_players: 0, is_open: true, createdAt: new Date() },
]);
const tok = await token(owner, 'Tulaj', 'owner');

// A logó, az időpont és a név helyzete egy kártyán / sorban
const measure = (p, rowSel) => p.$$eval(rowSel, rows => rows.map(r => {
  const img = r.querySelector('[data-jatek-ikon]');
  const time = [...r.querySelectorAll('b')].find(b => /^\d\d:\d\d$/.test(b.textContent.trim()));
  const name = [...r.querySelectorAll('b')].find(b => !/^\d\d:\d\d$/.test(b.textContent.trim()));
  if (!img || !time || !name) return null;
  const [i, t, n] = [img, time, name].map(el => el.getBoundingClientRect());
  return {
    src: img.getAttribute('src'), loaded: img.complete && img.naturalWidth > 0, w: Math.round(i.width), h: Math.round(i.height), name: name.textContent.trim(),
    between: t.right <= i.left && i.right <= n.left, // gépen: időpont → logó → név
    column: i.bottom <= t.top + 1 && Math.abs((i.left + i.right) / 2 - (t.left + t.right) / 2) < 4 && i.right <= n.left && t.right <= n.left, // telefonon: logó fölül, alatta az időpont, tőlük jobbra a név
    whole: name.scrollWidth <= name.clientWidth + 1 && name.scrollHeight <= name.clientHeight + 1 && getComputedStyle(name).textOverflow !== 'ellipsis',
    lines: Math.round(n.height / parseFloat(getComputedStyle(name).lineHeight)),
  };
}));

const b = await browser();
try {
  const phone = await page(b, tok, 402, 874);
  await phone.goto(`${BASE}/admin`, { waitUntil: 'networkidle2', timeout: 240000 });
  await phone.waitForSelector('[data-kartya] [data-jatek-ikon]', { timeout: 60000 });
  const cards = (await measure(phone, '[data-kartya]')).filter(Boolean);
  ok(cards.length === 4, `telefonon minden kártyán van logó (${cards.length})`);
  ok(cards.every(c => c.column), 'telefonon bal oldalt a logó és alatta az időpont, jobbra a név');
  ok(cards.every(c => c.loaded && c.w === 64 && c.h === 26), 'telefonon a logók betöltődtek, 64×26 px');
  ok(cards.every(c => c.whole), 'telefonon a név sehol nincs levágva');
  ok(cards.find(c => c.name === LONG)?.lines >= 2, 'a hosszú név több sorba törik, nem rövidül');
  ok(cards.find(c => c.name === 'Pokémon klubnap')?.src === '/jatekok/kicsi/pokemon.png' && cards.find(c => c.name === 'Társasjáték est')?.src === '/jatekok/kicsi/egyeb.png', 'a játéknak megfelelő logó (az Egyébnél is)');
  await phone.screenshot({ path: `${SHOTS}admin-jatek-ikon-telefon.jpg`, quality: 60 });

  const desk = await page(b, tok, 1280, 900);
  await desk.goto(`${BASE}/admin`, { waitUntil: 'networkidle2', timeout: 240000 });
  await desk.waitForSelector('tr [data-jatek-ikon]', { timeout: 60000 });
  const rows = (await measure(desk, 'tr')).filter(Boolean);
  ok(rows.length === 4 && rows.every(r => r.between && r.loaded && r.h >= 32 && r.w === 104), `gépen a táblázatban az időpont és a név között (${rows.length})`);
  await desk.screenshot({ path: `${SHOTS}admin-jatek-ikon-gep.jpg`, quality: 60 });
  console.log('  böngészőhibák:', [...phone.errs, ...desk.errs].join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
