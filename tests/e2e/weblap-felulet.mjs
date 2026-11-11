// Task 4: a szerkesztőfelület fülei, a Képfal szerkesztése, kirakás az előnézetből, telefonos nézet.
import { openDb, token, get, browser, page, bodyText, clickText, ok, summary, wait, SHOTS, BASE } from './lib.mjs';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { client, db } = await openDb();
const ids = (await db.collection('users').insertMany([
  { username: 'Uj', email: 'u@x.hu', password: 'x', role: 'admin', features: ['website'], allowedCategories: [], allowedStores: [] },
])).insertedIds;
const editor = await token(ids[0], 'Uj', 'admin');
// a szerkesztő a nulláról kezdi: üres képfal (alapból a bolt fotóival indulna)
await db.collection('website_content').insertOne({ _id: 'site', slideshow: { title: 'A boltokból', pictures: [] } });
const tabs = (p) => p.$$eval('nav[aria-label="A szerkesztőfelület részei"] a', as => as.map(a => a.textContent.trim()));
const IMG = (n) => `https://i.ibb.co/teszt/kep${n}.jpg`;

const b = await browser();
try {
  const p = await page(b, editor);
  await p.goto(`${BASE}/weblapteszt/admin`, { waitUntil: 'networkidle2', timeout: 240000 });
  ok((await tabs(p)).join(',') === 'Hírek,Galéria,Képfal', 'a fülek: Hírek, Galéria, Képfal');
  await p.goto(`${BASE}/weblapteszt/admin?lap=hero`, { waitUntil: 'networkidle2' });
  ok((await p.$eval('[aria-current="page"]', a => a.textContent.trim())) === 'Hírek' && !!(await p.$('input[name=title]')), 'régi cím (?lap=hero): a Hírek fül nyílik');

  // Képfal: két kép linkkel, felirat, mentés
  await p.goto(`${BASE}/weblapteszt/admin?lap=slideshow`, { waitUntil: 'networkidle2' });
  ok((await bodyText(p)).includes('Még nincs kép'), 'üres képfal: magyarázó szöveg');
  for (const n of [1, 2]) {
    await p.$eval('input[aria-label="Kép linkje"]', el => { el.value = ''; });
    await p.type('input[aria-label="Kép linkje"]', IMG(n));
    await clickText(p, 'button', 'Hozzáadás');
    await wait(150);
  }
  ok((await p.$$('[data-photo]')).length === 2, 'két kép a rácsban');
  await p.type('[data-photo]:first-child input[aria-label^="Felirat"]', 'Péntek este');
  await clickText(p, '[data-photo]:nth-child(2) button', 'Előre');
  ok((await p.$eval('[data-photo]:first-child img', i => i.getAttribute('src'))) === IMG(2), 'sorrend: a második kép előre került');
  await clickText(p, 'button', 'Mentés az előnézetbe');
  await p.waitForFunction(() => document.body.innerText.includes('Elmentve'), { timeout: 20000 });
  ok(true, 'mentés: „Elmentve”');

  // feltöltés kulcs nélkül: a hiba a fájl nevével
  writeFileSync(join(tmpdir(), 'tavern-e2e-proba.png'), Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex'));
  const input = await p.$('input[type=file][multiple]');
  await input.uploadFile(join(tmpdir(), 'tavern-e2e-proba.png'));
  await p.waitForFunction(() => [...document.querySelectorAll('ul[role=status] li')].some(li => li.textContent.includes('tavern-e2e-proba.png') && !li.textContent.includes('feltöltés…')), { timeout: 20000 });
  ok((await bodyText(p)).includes('nincs beállítva'), 'sikertelen feltöltés: hiba a fájl nevével');

  // hamisított mentés egy nem szerkeszthető fülre
  await p.$eval('input[name=tab]', el => { el.value = 'hero'; });
  await p.$eval('input[name=payload]', el => { el.value = JSON.stringify({ text: 'Feltört' }); });
  await p.$eval('[data-photo]:first-child input[aria-label^="Felirat"]', el => el.focus());
  await p.keyboard.type('!');
  await p.$eval('input[name=tab]', el => { el.value = 'hero'; });
  await p.$eval('input[name=payload]', el => el.form.requestSubmit());
  await p.waitForFunction(() => document.body.innerText.includes('nem lehet szerkeszteni'), { timeout: 20000 }).catch(() => {});
  ok((await bodyText(p)).includes('nem lehet szerkeszteni'), 'más fül mentése elutasítva');
  const draft = await db.collection('website_content').findOne({ _id: 'draft' });
  ok(!draft?.hero, 'a nyitókép nem változott');

  // előnézet és kirakás
  let live = await (await get('/weblapteszt')).text();
  ok(!live.includes('kepfal-cim'), 'élesben még nincs képfal');
  await p.goto(`${BASE}/weblapteszt/admin`, { waitUntil: 'networkidle2' });
  await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle2' }), clickText(p, 'a', 'Megnézem és kirakom')]);
  ok(!!(await p.$('section[aria-labelledby="kepfal-cim"]')), 'az előnézetben látszik a képfal');
  await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle2' }), clickText(p, '[aria-label="Előnézet"] button', 'Kirakás az éles oldalra')]);
  live = await (await get('/weblapteszt')).text();
  ok(live.includes('kepfal-cim') && live.includes('Péntek este'), 'kirakás után élesben is');

  // telefon: minden fül, nincs vízszintes görgetés, alsó fülsáv
  const m = await page(b, editor, 402, 874);
  for (const [lap, name] of [['', 'hirek'], ['gallery', 'galeria'], ['slideshow', 'kepfal']]) {
    await m.goto(`${BASE}/weblapteszt/admin${lap ? `?lap=${lap}` : ''}`, { waitUntil: 'networkidle2' });
    ok((await m.evaluate(() => document.documentElement.scrollWidth)) === 402, `telefon (${name}): nincs vízszintes görgetés`);
    await m.screenshot({ path: `${SHOTS}t4-telefon-${name}.jpg`, quality: 60 });
    await m.screenshot({ path: `${SHOTS}t4-telefon-${name}-teljes.jpg`, quality: 50, fullPage: true });
  }
  const nav = await m.$eval('nav[aria-label="A szerkesztőfelület részei"]', n => { const r = n.getBoundingClientRect(); return { bottom: Math.round(r.bottom), pos: getComputedStyle(n).position }; });
  ok(nav.pos === 'fixed' && nav.bottom >= 860, 'telefonon a fülek alul');
  const small = await m.$$eval('button, a, input, label[class]', els => els.filter(e => e.offsetParent && e.getBoundingClientRect().height < 44 && e.getBoundingClientRect().height > 1 && !['checkbox', 'hidden'].includes(e.type)).map(e => `${e.tagName}:${(e.textContent || e.getAttribute('aria-label') || e.name || '').trim().slice(0, 20)}`));
  ok(small.length === 0, `telefonon minden gomb legalább 44 px (${small.slice(0, 6).join(' | ')})`);
  const d = await page(b, editor, 1440, 900);
  for (const [lap, name] of [['', 'hirek'], ['slideshow', 'kepfal']]) {
    await d.goto(`${BASE}/weblapteszt/admin${lap ? `?lap=${lap}` : ''}`, { waitUntil: 'networkidle2' });
    await d.screenshot({ path: `${SHOTS}t4-gep-${name}.jpg`, quality: 60 });
  }
  console.log('  böngészőhibák:', [...p.errs, ...m.errs].join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
