// Weboldal: a Galéria oldal (menüpont fent, telefonon is), albumok mappa-feltöltéssel (mappánként egy album, a névből dátum
// és játék), előnézet, kirakás, játékszűrő, album oldala és nagyító. FAKE_IMGBB=1 szerverrel (a feltöltés 1,5 mp után sikerül).
import { openDb, token, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { client, db } = await openDb();
const ids = (await db.collection('users').insertMany([
  { username: 'Galeria', email: 'g@x.hu', password: 'x', role: 'admin', features: ['website'], allowedCategories: [], allowedStores: [] },
])).insertedIds;
const editor = await token(ids[0], 'Galeria', 'admin');
// a mappa: Események/<esemény>/<képek>, plusz egy nem kép fájl (a rendszer ideiglenes mappájában)
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
const DIR = join(mkdtempSync(join(tmpdir(), 'tavern-e2e-galeria-')), 'Események');
for (const [folder, files] of [['Pokeween 2026-10-31', ['1.png', '2.png']], ['Riftbound Skirmish 2026-11-08', ['a.png']]]) {
  mkdirSync(join(DIR, folder), { recursive: true });
  for (const f of files) writeFileSync(join(DIR, folder, f), PNG);
}
writeFileSync(join(DIR, 'Riftbound Skirmish 2026-11-08', 'jegyzet.txt'), 'nem kép');
const finished = (p) => p.waitForFunction(() => /Kész: \d+ \/ \d+ kép/.test(document.querySelector('[data-mappa]')?.textContent || ''), { timeout: 60000 }).catch(() => {});
const heads = (p) => p.$$eval('details summary b', els => els.map(e => e.textContent));

const b = await browser();
try {
  // üres Galéria, menüpont
  const p = await page(b, null);
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 240000 });
  const menu = await p.$eval('[data-menu="galeria"]', a => ({ href: a.getAttribute('href'), text: a.textContent, visible: !!a.offsetParent }));
  ok(menu.visible && menu.text === 'Galéria' && menu.href === '/galeria', `a fenti menüben a Galéria (${menu.href})`);
  await p.goto(`${BASE}/galeria`, { waitUntil: 'networkidle2' });
  ok(/Hamarosan itt lesznek/.test(await p.evaluate(() => document.body.innerText)), 'album nélkül: „hamarosan” szöveg');

  // feltöltés mappából a szerkesztőfelületen
  const a = await page(b, editor);
  await a.goto(`${BASE}/weblapteszt/admin?lap=albums`, { waitUntil: 'networkidle2', timeout: 240000 });
  await a.waitForSelector('[data-mappa] input[type=file]', { timeout: 120000 });
  const input = await a.$('[data-mappa] input[type=file]');
  ok(await input.evaluate(i => i.webkitdirectory), 'a „Mappa feltöltése” mappát választ');
  await input.uploadFile(DIR);
  await finished(a);
  const run = await a.$eval('[data-mappa]', el => el.textContent);
  ok(/Kész: 3 \/ 3 kép/.test(run), `3 kép feltöltve, a nem kép fájl kimaradt (${run.slice(0, 160)})`);
  const h1 = await heads(a);
  ok(h1.some(h => /^Pokeween · 2026-10-31 · 2 kép/.test(h)) && h1.some(h => /^Riftbound Skirmish · 2026-11-08 · 1 kép/.test(h)), `mappánként egy album, a névből dátum (${h1.join(' | ')})`);
  await a.screenshot({ path: `${SHOTS}galeria-admin.jpg`, quality: 60, fullPage: true });
  await a.evaluate(() => [...document.querySelectorAll('button')].find(x => /Mentés az előnézetbe/.test(x.textContent)).click());
  await a.waitForFunction(() => /Elmentve/.test(document.body.innerText), { timeout: 30000 }).catch(() => {});
  const draft = await db.collection('website_content').findOne({ _id: 'draft' });
  const albums = draft?.albums?.albums || [];
  ok(albums.length === 2 && albums.find(x => x.title === 'Pokeween')?.game === 'Pokémon TCG' && albums.find(x => x.title === 'Riftbound Skirmish')?.game === 'Riftbound', 'mentve az előnézetbe, a játék a névből');
  // ugyanaz a mappa újra: a meglévő albumokba kerül, nem lesz új album
  await (await a.$('[data-mappa] input[type=file]')).uploadFile(DIR);
  await wait(500);
  await finished(a);
  const h2 = await heads(a);
  ok(h2.length === 2 && h2.some(h => /Pokeween · 2026-10-31 · 4 kép/.test(h)), `újra feltöltve a meglévő albumba kerül (${h2.join(' | ')})`);

  // előnézet: látszik; élesben még nem
  await a.goto(`${BASE}/weblapteszt/elonezet/galeria`, { waitUntil: 'networkidle2' });
  ok((await a.$$('[data-album]')).length === 2, 'az előnézetben a 2 album');
  const adminErrs = a.errs;
  await a.close();
  await p.goto(`${BASE}/galeria`, { waitUntil: 'networkidle2' });
  ok((await p.$$('[data-album]')).length === 0, 'élesben még nincs kint');

  // kirakás (mint az előnézet Kirakás gombja), éles oldal
  await db.collection('website_content').updateOne({ _id: 'site' }, { $set: { albums: draft.albums } }, { upsert: true });
  await p.goto(`${BASE}/galeria`, { waitUntil: 'networkidle2' });
  const cards = await p.$$eval('[data-album]', els => els.map(e => e.textContent));
  ok(cards.length === 2 && /Riftbound Skirmish/.test(cards[0]) && /2026\. november 8\./.test(cards[0]), `a legfrissebb esemény elöl, magyar dátummal (${cards[0]})`);
  ok(await p.$eval('[data-menu="galeria"]', el => el.getAttribute('aria-current') === 'page'), 'a menüpont kiemelve a Galéria oldalon');
  await p.evaluate(() => [...document.querySelectorAll('[aria-label="Szűrés játék szerint"] button')].find(x => x.textContent === 'Pokémon').click());
  await wait(150);
  ok((await p.$$eval('[data-album]', els => els.map(e => e.textContent))).every(t => /Pokeween/.test(t)), 'játékszűrő: csak a Pokémon albumai');
  await p.screenshot({ path: `${SHOTS}galeria.jpg`, quality: 60 });
  await p.click('[data-album]');
  await p.waitForSelector('[data-kep]', { timeout: 30000 });
  ok(p.url().endsWith('/galeria/pokeween') && (await p.$$('[data-kep]')).length === 2, `az album oldalán a képek, a link az esemény nevéből (${p.url().replace(BASE, '')})`);
  // a régi, azonosítós link átirányít az újra
  const oldId = draft.albums.albums.find(x => x.title === 'Pokeween').id;
  const p2 = await page(b, null);
  await p2.goto(`${BASE}/galeria/${oldId}`, { waitUntil: 'networkidle2' });
  ok(p2.url().endsWith('/galeria/pokeween'), `a régi link (${oldId}) átirányít: ${p2.url().replace(BASE, '')}`);
  await p2.close();
  await p.click('[data-kep]');
  await wait(300);
  ok(await p.$eval('[data-nagyito]', d => /1 \/ 2/.test(d.textContent) && d.contains(document.activeElement)), 'kattintásra nagyban, 1 / 2, a fókusz a nagyítóban');
  await p.keyboard.press('ArrowRight');
  await wait(150);
  ok(await p.$eval('[data-nagyito]', d => /2 \/ 2/.test(d.textContent)), 'nyíllal a következő kép');
  await p.keyboard.press('Escape');
  await wait(150);
  ok(!(await p.$('[data-nagyito]')), 'Esc-re bezárul');
  const res = await p.goto(`${BASE}/galeria/nincs-ilyen`, { waitUntil: 'networkidle2' });
  ok(res.status() === 404, 'ismeretlen album: 404');

  // főoldal: „Az összes album” nagy gomb a Galéria bal alsó sarkában; kattintásra a fotók a gombba repülnek, arany borító
  // nyílik ki, utána a Galéria oldal, ahol a borító felhúzódik és az albumok beúsznak
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
  await p.$eval('#galeria', el => el.scrollIntoView({ block: 'center' }));
  await wait(900);
  const btn = await p.$eval('[data-osszes-album]', a => { const r = a.getBoundingClientRect(), sec = a.closest('section').getBoundingClientRect(); return { h: r.height, w: r.width, left: r.left - sec.left, bottom: sec.bottom - r.bottom, text: a.textContent, href: a.getAttribute('href') }; });
  ok(btn.h >= 64 && btn.w >= 280 && btn.left < 60 && btn.bottom < 60 && /Az összes album/.test(btn.text) && /2 album/.test(btn.text) && btn.href === '/galeria', `nagy gomb a bal alsó sarokban (${Math.round(btn.w)}×${Math.round(btn.h)}, ${btn.text})`);
  await p.screenshot({ path: `${SHOTS}galeria-gomb.jpg`, quality: 60 });
  const bb = await (await p.$('[data-osszes-album]')).boundingBox();
  await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await wait(450);
  const fly = await p.evaluate(() => ({ albumba: document.querySelector('#galeria').hasAttribute('data-albumba'), cover: !!document.querySelector('[data-album-borito]'), still: location.pathname }));
  ok(fly.albumba && fly.cover && fly.still === '/', 'kattintásra animáció: a fotók a gombba repülnek, nyílik a borító (még a főoldalon)');
  await p.screenshot({ path: `${SHOTS}galeria-gomb-repul.jpg`, quality: 60 });
  await wait(500);
  await p.screenshot({ path: `${SHOTS}galeria-gomb-borito.jpg`, quality: 60 });
  await p.waitForFunction(() => location.pathname === '/galeria', { timeout: 15000 }).catch(() => {});
  await p.waitForSelector('[data-album-fuggony]', { timeout: 5000 }).catch(() => {});
  ok(p.url().endsWith('/galeria') && !!(await p.$('[data-album-fuggony]')) && !!(await p.$('ul[data-belep]')), 'utána a Galéria oldal: a borító felhúzódik, az albumok beúsznak');
  await wait(300);
  await p.screenshot({ path: `${SHOTS}galeria-belepo.jpg`, quality: 60 });
  await wait(1800);
  ok(!(await p.$('[data-album-fuggony]')) && (await p.$$eval('[data-album]', els => els.every(e => +getComputedStyle(e.closest('li')).opacity === 1))), 'a végén a borító eltűnik, minden album látszik');
  // új lapon nyitva (Cmd/Ctrl) és csökkentett mozgásnál nincs animáció
  const r = await page(b, null);
  await r.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await r.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
  await r.$eval('[data-osszes-album]', el => el.scrollIntoView({ block: 'center' }));
  await r.click('[data-osszes-album]');
  await r.waitForFunction(() => location.pathname === '/galeria', { timeout: 15000 }).catch(() => {});
  ok(r.url().endsWith('/galeria') && !(await r.$('[data-album-fuggony]')), 'csökkentett mozgásnál rögtön nyílik, borító nélkül');
  await r.close();

  // telefon
  const ph = await page(b, null, 402, 874);
  await ph.goto(`${BASE}/galeria`, { waitUntil: 'networkidle2' });
  ok(await ph.$eval('[data-menu="galeria"]', el => !!el.offsetParent && el.getBoundingClientRect().height >= 44), 'telefonon is látszik a Galéria menüpont (44 px)');
  ok((await ph.evaluate(() => document.documentElement.scrollWidth)) === 402, 'telefonon nincs vízszintes görgetés');
  await ph.screenshot({ path: `${SHOTS}galeria-telefon.jpg`, quality: 60 });
  await ph.evaluate(() => [...document.querySelectorAll('[data-album]')].find(x => /Pokeween/.test(x.textContent)).click());
  await ph.waitForSelector('[data-kep]');
  await ph.click('[data-kep]');
  await wait(300);
  const nav = await ph.$$eval('[data-nagyito] button', bs => bs.map(x => Math.round(x.getBoundingClientRect().height)));
  ok(nav.length === 3 && nav.every(h => h >= 44), `telefonon a nagyító gombjai legalább 44 px (${nav.join(', ')})`);
  await ph.screenshot({ path: `${SHOTS}galeria-nagyito-telefon.jpg`, quality: 60 });
  // főoldal: link a Galériára a fotók mellett
  await ph.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
  ok(await ph.evaluate(() => [...document.querySelectorAll('#galeria a')].some(el => el.getAttribute('href') === '/galeria')), 'a főoldal fotóinál link a Galériára');
  console.log('  böngészőhibák:', [...p.errs, ...adminErrs, ...ph.errs].join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
