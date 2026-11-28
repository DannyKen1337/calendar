// Admin eseménylista: a játék ikonja az időpont és az esemény neve között áll (telefonon a kártyán, gépen a táblázatban).
import { openDb, token, browser, page, ok, summary, SHOTS, BASE } from './lib.mjs';

const { client, db } = await openDb();
const owner = (await db.collection('users').insertOne({ username: 'Tulaj', email: 'o@x.hu', password: 'x', role: 'owner', lastSeenChangelog: '9999' })).insertedId;
const pad = (n) => String(n).padStart(2, '0');
const d = new Date();
const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
await db.collection('tournaments').insertMany([
  { name: 'Pokémon klubnap', date: `${today}T23:30`, category: 'Pokémon TCG', store: 'debrecen', max_players: 16, current_players: 0, is_open: true, createdAt: new Date() },
  { name: 'One Piece bajnokság', date: `${today}T23:45`, category: 'One Piece Card Game', store: 'debrecen', max_players: 16, current_players: 0, is_open: true, createdAt: new Date() },
  { name: 'Társasjáték est', date: `${today}T23:50`, category: 'Egyéb', store: 'debrecen', max_players: 16, current_players: 0, is_open: true, createdAt: new Date() },
]);
const tok = await token(owner, 'Tulaj', 'owner');

// A sorrend a kártyán / a sorban: időpont → ikon → név (a képernyőn balról jobbra), és az ikon betöltődött
const order = (p, rowSel) => p.$$eval(rowSel, rows => rows.map(r => {
  const img = r.querySelector('[data-jatek-ikon]');
  const time = [...r.querySelectorAll('b')].find(b => /^\d\d:\d\d$/.test(b.textContent.trim()));
  const name = [...r.querySelectorAll('b')].find(b => !/^\d\d:\d\d$/.test(b.textContent.trim()));
  if (!img || !time || !name) return null;
  const x = (el) => el.getBoundingClientRect();
  return { src: img.getAttribute('src'), loaded: img.complete && img.naturalWidth > 0, between: x(time).right <= x(img).left && x(img).right <= x(name).left, w: Math.round(x(img).width), h: Math.round(x(img).height), name: name.textContent.trim() };
}));

const b = await browser();
try {
  const phone = await page(b, tok, 402, 874);
  await phone.goto(`${BASE}/admin`, { waitUntil: 'networkidle2', timeout: 240000 });
  await phone.waitForSelector('[data-kartya] [data-jatek-ikon]', { timeout: 60000 });
  const cards = (await order(phone, '[data-kartya]')).filter(Boolean);
  ok(cards.length === 3, `telefonon mindhárom kártyán van ikon (${cards.length})`);
  ok(cards.every(c => c.between), 'telefonon az ikon az időpont és a név között');
  ok(cards.every(c => c.loaded && c.w >= 20 && c.h >= 28 && c.w === 76), 'telefonon az ikonok betöltődtek, 76×28 px');
  ok(cards.find(c => c.name === 'Pokémon klubnap')?.src === '/jatekok/kicsi/pokemon.png' && cards.find(c => c.name === 'Társasjáték est')?.src === '/jatekok/kicsi/egyeb.png', 'a játéknak megfelelő ikon (az Egyébnél is)');
  await phone.screenshot({ path: `${SHOTS}admin-jatek-ikon-telefon.jpg`, quality: 60 });

  const desk = await page(b, tok, 1280, 900);
  await desk.goto(`${BASE}/admin`, { waitUntil: 'networkidle2', timeout: 240000 });
  await desk.waitForSelector('tr [data-jatek-ikon]', { timeout: 60000 });
  const rows = (await order(desk, 'tr')).filter(Boolean);
  ok(rows.length === 3 && rows.every(r => r.between && r.loaded && r.h >= 32 && r.w === 104), `gépen a táblázatban is az időpont és a név között (${rows.length})`);
  await desk.screenshot({ path: `${SHOTS}admin-jatek-ikon-gep.jpg`, quality: 60 });
  console.log('  böngészőhibák:', [...phone.errs, ...desk.errs].join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
