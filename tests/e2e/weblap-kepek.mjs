// Weboldal szerkesztő: a nagy (iPhone-méretű, 4 MB fölötti) fotók feltöltés előtt a böngészőben tömörítődnek – a Képfalon,
// a Galéria albumaiban és a Hírek űrlapján is –, és szépek maradnak (a hosszabbik oldal 2560 px, jó minőségű JPEG).
// FAKE_IMGBB=1 szerverrel: az ál-ImgBB a cím végére írja a kapott kép méretét bájtban.
import { openDb, token, browser, page, ok, summary, wait, BASE, SHOTS } from './lib.mjs';
import { mkdtempSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const { client, db } = await openDb();
const ids = (await db.collection('users').insertMany([
  { username: 'Kepes', email: 'k@x.hu', password: 'x', role: 'admin', features: ['website'], allowedCategories: [], allowedStores: [] },
])).insertedIds;
const editor = await token(ids[0], 'Kepes', 'admin');
await db.collection('website_content').insertOne({ _id: 'site', slideshow: { title: 'A boltokból', pictures: [] } });

// egy „iPhone-fotó”: 4032 × 3024, zajos (rosszul tömöríthető), JPEG 100-as minőségben – jóval 4 MB fölött
const DIR = mkdtempSync(join(tmpdir(), 'tavern-e2e-kepek-'));
const BIG = join(DIR, 'IMG_0001.jpg');
await sharp({ create: { width: 4032, height: 3024, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 70 } } }).jpeg({ quality: 100 }).toFile(BIG);
const bigSize = statSync(BIG).size;
ok(bigSize > 4 * 1024 * 1024, `a tesztfotó nagyobb 4 MB-nál (${(bigSize / 1048576).toFixed(1)} MB)`);
// egy „ProRAW” DNG: TIFF fejléc (Orientation = 6), benne egy veszteségmentes nyers rész és egy nagy JPEG-előnézet
const RAW = mkdtempSync(join(tmpdir(), 'tavern-e2e-raw-'));
const DNG = join(RAW, 'IMG_8673.DNG');
{
  const head = Buffer.alloc(26);
  head.write('II', 0, 'latin1'); head.writeUInt16LE(42, 2); head.writeUInt32LE(8, 4); head.writeUInt16LE(1, 8);
  head.writeUInt16LE(0x0112, 10); head.writeUInt16LE(3, 12); head.writeUInt32LE(1, 14); head.writeUInt16LE(6, 18);
  const preview = await sharp({ create: { width: 4032, height: 3024, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 60 } } }).jpeg({ quality: 95 }).toBuffer();
  const lossless = Buffer.from([0xff, 0xd8, 0xff, 0xc3, 0x00, 0x0b, 0x10, 0x03, 0x20, 0x03, 0xe8, 0x01, 0x01, 0x11, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x01, 0x00, 0x00, 0x12, 0x34, 0xff, 0xd9]);
  writeFileSync(DNG, Buffer.concat([head, Buffer.alloc(200), lossless, preview, Buffer.alloc(100)]));
}
// két hibás „kép” egy mappában (a hibák összevonásához)
const BAD = mkdtempSync(join(tmpdir(), 'tavern-e2e-rossz-'));
mkdirSync(join(BAD, 'Hibas'));
for (const n of ['a.jpg', 'b.jpg']) writeFileSync(join(BAD, 'Hibas', n), 'nem kép');
const sentSize = (src) => +(String(src).match(/-(\d+)\.(jpg|png)$/)?.[1] || 0);

const b = await browser();
try {
  // Képfal
  const p = await page(b, editor);
  await p.goto(`${BASE}/weblapteszt/admin?lap=slideshow`, { waitUntil: 'networkidle2', timeout: 240000 });
  await p.waitForSelector('input[type=file][multiple]', { timeout: 120000 });
  await (await p.$('input[type=file][multiple]')).uploadFile(BIG);
  await p.waitForFunction(() => document.querySelectorAll('[data-photo]').length > 0 || /legfeljebb 4 MB|nem tudtuk/i.test(document.body.innerText), { timeout: 60000 }).catch(() => {});
  const src = await p.$eval('[data-photo] img', i => i.getAttribute('src')).catch(() => '');
  const text = await p.evaluate(() => document.body.innerText);
  ok(!!src && !/legfeljebb 4 MB/i.test(text), `Képfal: a 4 MB fölötti fotó is felment, hiba nélkül (${src})`);
  ok(sentSize(src) > 0 && sentSize(src) <= 3.5 * 1024 * 1024 && /\.jpg$/.test(src), `Képfal: tömörítve ment fel (${(sentSize(src) / 1048576).toFixed(2)} MB JPEG)`);
  ok(sentSize(src) > 300 * 1024, 'Képfal: nem túltömörítve (szép marad)');

  // szerkesztés feltöltés után: jobbra forgatás → álló kép kerül a helyére (az ál-kép 300 × 200-as)
  await p.click('[data-photo] [data-szerkeszt]');
  await p.waitForSelector('[data-kepszerkeszto][open]', { timeout: 10000 });
  await p.evaluate(() => [...document.querySelectorAll('[data-kepszerkeszto] button')].find(x => /Jobbra/.test(x.textContent)).click());
  await wait(100);
  ok(/rotate\(90deg\)/.test(await p.$eval('[data-kepszerkeszto] img', i => i.style.transform)), 'szerkesztés: az előnézet rögtön elfordul');
  await p.evaluate(() => [...document.querySelectorAll('[data-kepszerkeszto] button')].find(x => /^Kész$/.test(x.textContent)).click());
  await p.waitForFunction((old) => document.querySelector('[data-photo] img')?.getAttribute('src') !== old && !document.querySelector('[data-kepszerkeszto][open]'), { timeout: 30000 }, src).catch(() => {});
  const edited = await p.$eval('[data-photo] img', i => i.getAttribute('src'));
  ok(/-200x300-\d+\.jpg$/.test(edited), `szerkesztés: jobbra forgatva, álló kép került a helyére (${edited})`);
  await p.click('[data-photo] [data-szerkeszt]');
  await p.waitForSelector('[data-kepszerkeszto][open]');
  await p.keyboard.press('Escape');
  await wait(200);
  ok(!(await p.$('[data-kepszerkeszto]')) && (await p.$eval('[data-photo] img', i => i.getAttribute('src'))) === edited, 'szerkesztés: Esc-re bezárul, nem változik semmi');
  await p.evaluate(() => [...document.querySelectorAll('button')].find(x => /Mentés az előnézetbe/.test(x.textContent)).click());
  await p.waitForFunction(() => /Elmentve/.test(document.body.innerText), { timeout: 30000 }).catch(() => {});
  const ph = await page(b, editor, 402, 874);
  await ph.goto(`${BASE}/weblapteszt/admin?lap=slideshow`, { waitUntil: 'networkidle2' });
  await ph.evaluate(() => document.querySelector('[data-photo] [data-szerkeszt]')?.click());
  await ph.waitForSelector('[data-kepszerkeszto][open]', { timeout: 10000 }).catch(() => {});
  const tools = await ph.$$eval('[data-kepszerkeszto] button', bs => bs.map(x => Math.round(x.getBoundingClientRect().height)));
  ok(tools.length >= 8 && tools.every(h => h >= 44) && (await ph.evaluate(() => document.documentElement.scrollWidth)) === 402, `telefonon: a szerkesztő gombjai legalább 44 px (${tools.join(', ')})`);
  await ph.screenshot({ path: `${SHOTS}kepszerkeszto-telefon.jpg`, quality: 60 });
  await ph.close();

  // Galéria album: a mappa-feltöltés is tömörít
  await p.goto(`${BASE}/weblapteszt/admin?lap=albums`, { waitUntil: 'networkidle2' });
  await p.waitForSelector('[data-mappa] input[type=file]', { timeout: 120000 });
  await (await p.$('[data-mappa] input[type=file]')).uploadFile(DIR);
  await p.waitForFunction(() => /Kész: \d+ \/ \d+ kép/.test(document.querySelector('[data-mappa]')?.textContent || ''), { timeout: 60000 }).catch(() => {});
  ok(/Kész: 1 \/ 1 kép/.test(await p.$eval('[data-mappa]', el => el.textContent)) && !(await p.$('[data-mappa] li')), 'Galéria: a mappa nagy fotója is hiba nélkül felment');

  // RAW (DNG): a beágyazott előnézet megy fel, tömörítve
  await p.goto(`${BASE}/weblapteszt/admin?lap=slideshow`, { waitUntil: 'networkidle2' });
  await p.waitForSelector('input[type=file][multiple]', { timeout: 120000 });
  const before = (await p.$$('[data-photo]')).length;
  await (await p.$('input[type=file][multiple]')).uploadFile(DNG);
  await p.waitForFunction((n) => document.querySelectorAll('[data-photo]').length > n || /nem tudtuk|RAW/i.test(document.body.innerText), { timeout: 60000 }, before).catch(() => {});
  const rawSrc = await p.$$eval('[data-photo] img', els => els.map(i => i.getAttribute('src')).pop() || '');
  ok((await p.$$('[data-photo]')).length === before + 1 && sentSize(rawSrc) > 0 && sentSize(rawSrc) <= 3.5 * 1024 * 1024 && /\.jpg$/.test(rawSrc), `DNG (iPhone ProRAW): az előnézete tömörítve felment (${(sentSize(rawSrc) / 1048576).toFixed(2)} MB)`);

  // hibák összevonva, egy gombbal eltüntethetők
  await p.goto(`${BASE}/weblapteszt/admin?lap=albums`, { waitUntil: 'networkidle2' });
  await p.waitForSelector('[data-mappa] input[type=file]', { timeout: 120000 });
  await (await p.$('[data-mappa] input[type=file]')).uploadFile(BAD);
  await p.waitForSelector('[data-bezar]', { timeout: 60000 }).catch(() => {});
  const errs = await p.$$eval('[data-mappa] li', els => els.map(e => e.textContent));
  ok(errs.length === 1 && /^2 kép: /.test(errs[0]), `az azonos hibák egy sorban (${errs.join(' | ')})`);
  await p.click('[data-bezar]');
  await wait(150);
  ok(!(await p.$('[data-mappa] li')) && !(await p.$('[data-bezar]')), 'a „Hibák eltüntetése” gombbal eltűnnek');

  // Hírek űrlapja: a kiválasztott kép az űrlapban már tömörítve van
  await p.goto(`${BASE}/weblapteszt/admin`, { waitUntil: 'networkidle2' });
  await p.type('input[name="title"]', 'Képes hír');
  await (await p.$('input[name="imageFile"]')).uploadFile(BIG);
  await p.waitForFunction(() => { const f = document.querySelector('input[name="imageFile"]')?.files?.[0]; return (f && f.size < 4 * 1024 * 1024) || !!document.querySelector('form [role="alert"]'); }, { timeout: 60000 }).catch(() => {});
  await p.waitForFunction(() => [...document.querySelectorAll('button')].some(x => /Hír mentése/.test(x.textContent)), { timeout: 30000 }).catch(() => {});
  const inForm = await p.$eval('input[name="imageFile"]', i => ({ size: i.files[0]?.size || 0, type: i.files[0]?.type }));
  ok(inForm.size > 0 && inForm.size <= 3.5 * 1024 * 1024 && inForm.type === 'image/jpeg', `Hírek: az űrlapban a tömörített kép (${(inForm.size / 1048576).toFixed(2)} MB)`);
  await p.evaluate(() => [...document.querySelectorAll('button')].find(x => /Hír mentése/.test(x.textContent)).click());
  await p.waitForFunction(() => /Elmentve/.test(document.body.innerText), { timeout: 30000 }).catch(() => {});
  const post = await db.collection('website_posts').findOne({ title: 'Képes hír' });
  ok(!!post?.image && sentSize(post.image) <= 3.5 * 1024 * 1024, `Hírek: mentve, a kép tömörítve ment fel (${post?.image || 'nincs'})`);
  console.log('  böngészőhibák:', p.errs.join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
