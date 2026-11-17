// A végső átnézés javításai (FAKE_IMGBB=1 szerverrel: a feltöltés 1,5 mp után sikerül).
import { openDb, token, get, browser, page, clickText, ok, summary, wait, BASE } from './lib.mjs';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { client, db } = await openDb();
const ids = (await db.collection('users').insertMany([
  { username: 'Tulaj', email: 'o@x.hu', password: 'x', role: 'owner' },
  { username: 'Uj', email: 'u@x.hu', password: 'x', role: 'admin', features: ['website'], allowedCategories: [], allowedStores: [] },
])).insertedIds;
const owner = await token(ids[0], 'Tulaj', 'owner');
const editor = await token(ids[1], 'Uj', 'admin');
// főoldali fotók nélkül indul (alapból a bolt fotóival indulna)
await db.collection('website_content').insertOne({ _id: 'site', gallery: { note: '', pictures: [] } });
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
const files = [1, 2, 3].map(n => { const f = join(tmpdir(), `tavern-e2e-kep${n}.png`); writeFileSync(f, PNG); return f; });
const busy = (p) => p.evaluate(() => document.body.innerText.includes('feltöltés…'));
const waitIdle = (p) => p.waitForFunction(() => !document.body.innerText.includes('feltöltés…'), { timeout: 30000 });
const srcs = (p) => p.$$eval('[data-photo] img', els => els.map(e => e.getAttribute('src')));

// #3: a takarítás csak a modul-csoportot törli
await db.collection('settings').insertOne({ _id: 'default_groups_v1', at: new Date() });
await db.collection('user_groups').insertMany([
  { name: 'Weblap jóváhagyó', features: ['websitePublish'], allowedCategories: [], allowedStores: [] },
  { name: 'Debrecen + jóváhagyó', features: ['websitePublish'], allowedCategories: [], allowedStores: ['debrecen'] },
]);
await get('/api/admin-users', owner);
const g = await db.collection('user_groups').find().toArray();
ok(!g.some(x => x.name === 'Weblap jóváhagyó'), '#3 a modul-csoport törölve');
const custom = g.find(x => x.name === 'Debrecen + jóváhagyó');
ok(custom && custom.allowedStores.join() === 'debrecen' && custom.features.length === 0, '#3 az egyedi csoport megmarad a bolti jogával');

const b = await browser();
try {
  // egy fotóval indul: a leírását írjuk át feltöltés közben
  await db.collection('website_content').updateOne({ _id: 'draft' }, { $set: { gallery: { pictures: [{ id: 'k0', picture: { src: 'https://i.ibb.co/x/elso.jpg', alt: '', position: '50% 50%' } }] } } }, { upsert: true });
  const p = await page(b, editor);
  await p.goto(`${BASE}/weblapteszt/admin?lap=gallery`, { waitUntil: 'networkidle2', timeout: 240000 });
  await p.waitForSelector('input[type=file][multiple]', { timeout: 120000 }); // friss szervernél az oldal még fordulhat

  // #10: a fájlválasztó billentyűzettel elérhető
  ok(await p.$eval('input[type=file][multiple]', el => { el.focus(); return document.activeElement === el; }), '#10 a képfeltöltés fókuszálható');

  // #2: feltöltés közben nem lehet menteni
  await (await p.$('input[type=file][multiple]')).uploadFile(files[0], files[1]);
  await wait(300);
  ok(await busy(p), '#2 (előfeltétel) feltöltés folyamatban');
  ok(await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Mentés az előnézetbe')).disabled), '#2 feltöltés közben a mentés tiltva');

  // #1: feltöltés közben átírt képleírás megmarad
  const ALT = '[data-photo]:first-child input[aria-label^="Mi látható"]';
  await p.$eval(ALT, el => el.focus());
  await p.keyboard.type('Új leírás');
  await waitIdle(p);
  ok((await p.$eval(ALT, el => el.value)) === 'Új leírás', '#1 a képleírás nem ugrik vissza a feltöltés végén');
  ok((await p.$$('[data-photo]')).length === 3, '#1 mindkét kép bekerült');

  // #8: csere közben átrendezés: a cserélt kép kapja az új címet
  const before = await srcs(p);
  const replaceInput = await p.$('[data-photo]:nth-child(2) input[type=file]');
  await replaceInput.uploadFile(files[2]);
  await wait(200);
  await clickText(p, '[data-photo]:nth-child(2) button', 'Előre');
  await waitIdle(p);
  const after = await srcs(p);
  ok(after[0] !== before[1] && after[1] === before[0], '#8 a csere az átrendezett képen történik');

  // #9: két gyorsan egymás után indított feltöltés sem lépi át a 3 képet
  const two = Array.from({ length: 2 }, (_, i) => ({ id: `t${i}`, picture: { src: `https://i.ibb.co/x/${i}.jpg`, alt: '', position: '50% 50%' } }));
  await db.collection('website_content').updateOne({ _id: 'draft' }, { $set: { gallery: { note: '', pictures: two } } }, { upsert: true });
  await p.goto(`${BASE}/weblapteszt/admin?lap=gallery`, { waitUntil: 'networkidle2' });
  await (await p.$('input[type=file][multiple]')).uploadFile(files[0]);
  await wait(200);
  const again = await p.$('input[type=file][multiple]');
  if (again) await again.uploadFile(files[1]);
  await waitIdle(p);
  await wait(300);
  ok((await p.$$('[data-photo]')).length === 3, `#9 legfeljebb 3 kép marad (${(await p.$$('[data-photo]')).length})`);

  console.log('  böngészőhibák:', p.errs.join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
