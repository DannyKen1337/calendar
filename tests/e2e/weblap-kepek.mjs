// Weboldal szerkesztő: a nagy (iPhone-méretű, 4 MB fölötti) fotók feltöltés előtt a böngészőben tömörítődnek – a Képfalon,
// a Galéria albumaiban és a Hírek űrlapján is –, és szépek maradnak (a hosszabbik oldal 2560 px, jó minőségű JPEG).
// FAKE_IMGBB=1 szerverrel: az ál-ImgBB a cím végére írja a kapott kép méretét bájtban.
import { openDb, token, browser, page, ok, summary, wait, BASE } from './lib.mjs';
import { mkdtempSync, statSync } from 'node:fs';
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

  // Galéria album: a mappa-feltöltés is tömörít
  await p.goto(`${BASE}/weblapteszt/admin?lap=albums`, { waitUntil: 'networkidle2' });
  await p.waitForSelector('[data-mappa] input[type=file]', { timeout: 120000 });
  await (await p.$('[data-mappa] input[type=file]')).uploadFile(DIR);
  await p.waitForFunction(() => /Kész: \d+ \/ \d+ kép/.test(document.querySelector('[data-mappa]')?.textContent || ''), { timeout: 60000 }).catch(() => {});
  ok(/Kész: 1 \/ 1 kép/.test(await p.$eval('[data-mappa]', el => el.textContent)) && !(await p.$('[data-mappa] li')), 'Galéria: a mappa nagy fotója is hiba nélkül felment');

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
