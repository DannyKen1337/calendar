// Task 3: az Élő mozaik a főoldalon (képfal).
import { openDb, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';

const PHOTOS = ['bolt-asztalok.png', 'verseny.png', 'klub-asztal.png', 'pakli-bontas.png', 'csapat.png', 'miskolc-kirakat.jpg', 'jatekceh-kirakat.jpg'];
const pictures = PHOTOS.map((f, i) => ({ id: `k${i}`, picture: { src: `/photos/${f}`, alt: `Kép ${i}`, position: '50% 50%' }, caption: `Felirat ${i}` }));
const { client, db } = await openDb();
const setPics = (list) => db.collection('website_content').replaceOne({ _id: 'site' }, { slideshow: { title: 'A boltokból', pictures: list } }, { upsert: true });
const SEL = 'section[aria-labelledby="kepfal-cim"]';
const srcs = (p) => p.$$eval(`${SEL} [data-tile] img:last-of-type`, els => els.map(e => e.getAttribute('src')).join('|'));

const b = await browser();
try {
  // még semmi nincs mentve: a képfal a bolt saját fotóival indul
  let p = await page(b, null);
  await p.goto(`${BASE}/weblapteszt`, { waitUntil: 'networkidle2', timeout: 240000 });
  ok((await p.$$(`${SEL} [data-tile]`)).length === 5, 'alapból (mentett tartalom nélkül) a képfal a bolt fotóival látszik');

  // üres képfal (a szerkesztő mindet törölte): nincs blokk
  await setPics([]);
  await p.goto(`${BASE}/weblapteszt`, { waitUntil: 'networkidle2' });
  ok(!(await p.$(SEL)), '0 kép: nincs képfal');

  await setPics(pictures);
  await p.goto(`${BASE}/weblapteszt`, { waitUntil: 'networkidle2' });
  ok(!!(await p.$(SEL)), '7 kép: van képfal');
  ok((await p.$eval(SEL, el => el.querySelector('h2').textContent)) === 'A boltokból', 'a cím a tartalomból');
  ok((await p.$$(`${SEL} [data-tile]`)).length === 5, 'gépen 5 mező');
  await p.$eval(SEL, el => el.scrollIntoView({ block: 'center' }));
  const before = await srcs(p);
  await wait(3500);
  const after = await srcs(p);
  ok(before !== after, 'pár másodperc után egy mező képe kicserélődik');
  await p.waitForSelector(`${SEL} [data-tile] > div`, { timeout: 8000 }).catch(() => {});
  const dur = await p.evaluate((sel) => { const o = document.querySelector(`${sel} [data-tile] > div`); if (!o) return null; const sec = (v) => parseFloat(v) * (v.endsWith('ms') ? 0.001 : 1); return { open: sec(getComputedStyle(o).animationDuration), settle: sec(getComputedStyle(o.querySelector('img')).animationDuration) }; }, SEL);
  ok(dur && dur.settle <= dur.open, `a kép beállása nem tart tovább a kinyílásnál, nincs ugrás a végén (${JSON.stringify(dur)})`);
  ok(await p.$eval(SEL, el => el.textContent.includes('Felirat')), 'a feliratok látszanak');
  await p.screenshot({ path: `${SHOTS}t3-gep.jpg`, quality: 60 });

  // szünet
  const pause = await p.$(`${SEL} button[aria-label="Szünet"]`);
  ok(!!pause, 'van szünet gomb');
  await pause.click();
  ok(!!(await p.$(`${SEL} button[aria-label="Lejátszás"]`)), 'a gomb átvált lejátszásra');
  await wait(1300); const paused = await srcs(p); await wait(4000);
  ok(paused === (await srcs(p)), 'szünetben nem vált');

  // kevés kép: annyi mező, ahány kép, nincs csere
  await setPics(pictures.slice(0, 2));
  await p.goto(`${BASE}/weblapteszt`, { waitUntil: 'networkidle2' });
  ok((await p.$$(`${SEL} [data-tile]`)).length === 2, '2 kép: 2 mező');

  // telefon
  await setPics(pictures);
  p = await page(b, null, 402, 874);
  await p.goto(`${BASE}/weblapteszt`, { waitUntil: 'networkidle2' });
  ok((await p.$$eval(`${SEL} [data-tile]`, els => els.filter(e => getComputedStyle(e).display !== 'none').length)) === 4, 'telefonon 4 mező');
  ok((await p.evaluate(() => document.documentElement.scrollWidth)) === 402, 'telefonon nincs vízszintes görgetés');
  await p.$eval(SEL, el => el.scrollIntoView());
  await wait(800);
  await p.screenshot({ path: `${SHOTS}t3-telefon.jpg`, quality: 60 });

  // csökkentett mozgás: nem vált
  p = await page(b, null);
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.goto(`${BASE}/weblapteszt`, { waitUntil: 'networkidle2' });
  await p.$eval(SEL, el => el.scrollIntoView({ block: 'center' }));
  const r1 = await srcs(p); await wait(3500);
  ok(r1 === (await srcs(p)), 'csökkentett mozgásnál nem vált');
  console.log('  böngészőhibák:', p.errs.join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
