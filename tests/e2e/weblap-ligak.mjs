// Weboldal: a Ligák mezőben a publikált liga-ranglisták (2–4 liga), liganként az élmezőny és a teljes ranglista linkje.
import { openDb, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';

const { client, db } = await openDb();
const rows = (names) => names.map((n, i) => ({ playerId: `p${n}`, nickname: n, rank: i + 1, points: 30 - i * 4, delta: i === 0 ? 3 : 0 }));
const SEL = '[data-ligak]';
const cards = (p) => p.$$eval(`${SEL} [data-liga]`, els => els.map(e => ({ text: e.textContent, rows: [...e.querySelectorAll('li')].filter(li => li.offsetParent).length, href: e.querySelector('a')?.getAttribute('href') })));

const b = await browser();
try {
  // nincs liga: a mező a régi
  let p = await page(b, null);
  await p.goto(`${BASE}/weblapteszt`, { waitUntil: 'networkidle2', timeout: 240000 });
  ok(!(await p.$(SEL)), 'liga nélkül nincs ranglista-blokk');

  // három publikált liga (és egy publikálatlan, ami nem látszik)
  await db.collection('leagues').insertMany([
    { category: 'Pokémon TCG', name: 'Pokémon Liga – 2026 ősz', published: { at: new Date(), rows: rows(['K. Levente', 'N. Bianka', 'T. Ádám', 'Sz. Dávid', 'H. Gergő', 'V. Máté']) } },
    { category: 'One Piece Card Game', name: 'One Piece Liga', published: { at: new Date(), rows: rows(['B. Péter', 'K. Anna', 'T. Eszter']) } },
    { category: 'Riftbound', name: 'Riftbound Liga', published: { at: new Date(), rows: rows(['M. Zsolt', 'F. Réka', 'G. Bálint', 'L. Ádám', 'P. Nóra']) } },
    { category: 'Disney Lorcana', name: 'Lorcana Liga', published: null },
  ]);
  await p.goto(`${BASE}/weblapteszt`, { waitUntil: 'networkidle2' });
  const c = await cards(p);
  ok(c.length === 3, `3 publikált liga kártyája (${c.length})`);
  ok(c.some(x => /Pokémon Liga – 2026 ősz/.test(x.text) && /K\. Levente/.test(x.text) && /30/.test(x.text)), 'a kártyán a liga neve, az első helyezett és a pontja');
  ok(c.find(x => /Pokémon/.test(x.text))?.rows === 5, 'gépen liganként az első öt helyezett');
  ok(c.every(x => /^\/liga\//.test(x.href || '')), 'a „Teljes ranglista” a liga oldalára visz');
  ok(await p.$eval(`${SEL} [data-liga] a`, a => a.hasAttribute('data-cal')), 'a ranglista az oldalon belül, a naptárablakban nyílik');
  ok(await p.evaluate((sel) => getComputedStyle(document.querySelector(sel)).gridTemplateColumns.split(' ').length, SEL) === 3, '3 ligánál három oszlop');
  await p.$eval(SEL, el => el.scrollIntoView({ block: 'center' }));
  await wait(800);
  await p.screenshot({ path: `${SHOTS}ligak-gep.jpg`, quality: 60 });

  // négy liga: széles képernyőn négy oszlop, közepesen 2×2
  await db.collection('leagues').updateOne({ category: 'Disney Lorcana' }, { $set: { published: { at: new Date(), rows: rows(['A. Béla', 'C. Dóra']) } } });
  const wide = await page(b, null, 1440, 900);
  await wide.goto(`${BASE}/weblapteszt`, { waitUntil: 'networkidle2' });
  ok(await wide.evaluate((sel) => getComputedStyle(document.querySelector(sel)).gridTemplateColumns.split(' ').length, SEL) === 4, '4 ligánál széles képernyőn négy oszlop');
  const mid = await page(b, null, 1100, 900);
  await mid.goto(`${BASE}/weblapteszt`, { waitUntil: 'networkidle2' });
  ok(await mid.evaluate((sel) => getComputedStyle(document.querySelector(sel)).gridTemplateColumns.split(' ').length, SEL) === 2, '4 ligánál közepes képernyőn 2×2');

  // telefon: egymás alatt, liganként az első három
  const ph = await page(b, null, 402, 874);
  await ph.goto(`${BASE}/weblapteszt`, { waitUntil: 'networkidle2' });
  const pc = await cards(ph);
  ok(pc.length === 4 && pc.every(x => x.rows <= 3), 'telefonon liganként legfeljebb három helyezett');
  ok((await ph.evaluate(() => document.documentElement.scrollWidth)) === 402, 'telefonon nincs vízszintes görgetés');
  await ph.$eval(SEL, el => el.scrollIntoView());
  await wait(800);
  await ph.screenshot({ path: `${SHOTS}ligak-telefon.jpg`, quality: 60 });
  console.log('  böngészőhibák:', [...p.errs, ...ph.errs].join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
