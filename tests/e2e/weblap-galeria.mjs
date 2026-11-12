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
  await p.goto(`${BASE}/weblapteszt`, { waitUntil: 'networkidle2', timeout: 240000 });
  const menu = await p.$eval('[data-menu="galeria"]', a => ({ href: a.getAttribute('href'), text: a.textContent, visible: !!a.offsetParent }));
  ok(menu.visible && menu.text === 'Galéria' && menu.href === '/weblapteszt/galeria', `a fenti menüben a Galéria (${menu.href})`);
  await p.goto(`${BASE}/weblapteszt/galeria`, { waitUntil: 'networkidle2' });
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
  await p.goto(`${BASE}/weblapteszt/galeria`, { waitUntil: 'networkidle2' });
  ok((await p.$$('[data-album]')).length === 0, 'élesben még nincs kint');

  // kirakás (mint az előnézet Kirakás gombja), éles oldal
  await db.collection('website_content').updateOne({ _id: 'site' }, { $set: { albums: draft.albums } }, { upsert: true });
  await p.goto(`${BASE}/weblapteszt/galeria`, { waitUntil: 'networkidle2' });
  const cards = await p.$$eval('[data-album]', els => els.map(e => e.textContent));
  ok(cards.length === 2 && /Riftbound Skirmish/.test(cards[0]) && /2026\. november 8\./.test(cards[0]), `a legfrissebb esemény elöl, magyar dátummal (${cards[0]})`);
  ok(await p.$eval('[data-menu="galeria"]', el => el.getAttribute('aria-current') === 'page'), 'a menüpont kiemelve a Galéria oldalon');
  await p.evaluate(() => [...document.querySelectorAll('[aria-label="Szűrés játék szerint"] button')].find(x => x.textContent === 'Pokémon').click());
  await wait(150);
  ok((await p.$$eval('[data-album]', els => els.map(e => e.textContent))).every(t => /Pokeween/.test(t)), 'játékszűrő: csak a Pokémon albumai');
  await p.screenshot({ path: `${SHOTS}galeria.jpg`, quality: 60 });
  await p.click('[data-album]');
  await p.waitForSelector('[data-kep]', { timeout: 30000 });
  ok(p.url().endsWith('/weblapteszt/galeria/pokeween') && (await p.$$('[data-kep]')).length === 2, `az album oldalán a képek, a link az esemény nevéből (${p.url().replace(BASE, '')})`);
  // a régi, azonosítós link átirányít az újra
  const oldId = draft.albums.albums.find(x => x.title === 'Pokeween').id;
  const p2 = await page(b, null);
  await p2.goto(`${BASE}/weblapteszt/galeria/${oldId}`, { waitUntil: 'networkidle2' });
  ok(p2.url().endsWith('/weblapteszt/galeria/pokeween'), `a régi link (${oldId}) átirányít: ${p2.url().replace(BASE, '')}`);
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
  const res = await p.goto(`${BASE}/weblapteszt/galeria/nincs-ilyen`, { waitUntil: 'networkidle2' });
  ok(res.status() === 404, 'ismeretlen album: 404');

  // telefon
  const ph = await page(b, null, 402, 874);
  await ph.goto(`${BASE}/weblapteszt/galeria`, { waitUntil: 'networkidle2' });
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
  await ph.goto(`${BASE}/weblapteszt`, { waitUntil: 'networkidle2' });
  ok(await ph.evaluate(() => [...document.querySelectorAll('#galeria a')].some(el => el.getAttribute('href') === '/weblapteszt/galeria')), 'a főoldal fotóinál link a Galériára');
  console.log('  böngészőhibák:', [...p.errs, ...adminErrs, ...ph.errs].join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
