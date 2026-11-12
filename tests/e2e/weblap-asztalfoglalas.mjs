// Weboldal: az „Ülj be hozzánk” rész feljebb (a Hírek után), benne az asztalfoglalás blokkja és linkjei; kattintásra
// a saját ablakában (felbillenő „Foglalt” tábla) nyílik a beépített asztalfoglalás. Telefonon is.
import { openDb, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';

const { client, db } = await openDb();
const DLG = '[data-asztal-ablak]';
const b = await browser();
try {
  const p = await page(b, null);
  await p.goto(`${BASE}/weblapteszt`, { waitUntil: 'networkidle2', timeout: 240000 });
  const order = await p.evaluate(() => ['hirek', 'boltok', 'kinalat', 'kapcsolat'].map(id => document.getElementById(id)).map(el => el ? [...document.querySelectorAll('section')].indexOf(el.closest('section')) : -1));
  ok(order.every(i => i >= 0) && order[0] < order[1] && order[1] < order[2] && order[2] < order[3], `az „Ülj be hozzánk” a Hírek után, a nagy mondatok előtt (${order.join(', ')})`);
  ok((await p.$eval('#boltok-cim', h => h.textContent)) === 'Ülj be hozzánk', 'a rész címe: Ülj be hozzánk');
  const links = await p.$$eval('[data-asztalfoglalas] a[data-table]', as => as.map(a => a.getAttribute('href')));
  ok(links.length === 4 && /\/asztalfoglalas$/.test(links[0]) && ['debrecen', 'jatekceh', 'miskolc'].every(id => links.some(h => h.endsWith(`/asztalfoglalas?bolt=${id}`))), `asztalfoglalás gomb és boltonkénti linkek (${links.length})`);
  ok(await p.$eval('#boltok', sec => !!sec.querySelector('[data-map]') && !!sec.querySelector('[data-asztalfoglalas]')), 'a blokk a térképes boltok mellett van');
  // a boltok neve egységesen, a teljes heti nyitvatartás a bolt sorában
  const rows = await p.$$eval('#boltok a[data-map]', as => as.map(a => ({ name: a.querySelector('h3').textContent, days: [...a.querySelectorAll('[data-nyitvatartas] dt')].map(d => d.childNodes[0].textContent), text: a.querySelector('[data-nyitvatartas]')?.textContent || '', ma: a.querySelectorAll('[data-ma]').length })));
  ok(rows.map(r => r.name).join('|') === 'Tavern Debrecen|JátékCéh|Tavern Miskolc', `a boltok neve: ${rows.map(r => r.name).join(', ')}`);
  const WEEK = 'Hétfő|Kedd|Szerda|Csütörtök|Péntek|Szombat|Vasárnap';
  ok(rows.every(r => r.days.join('|') === WEEK && r.ma === 1), 'minden boltnál a hét minden napja külön sorban, a mai nap kiemelve');
  ok(/Hétfő(Ma)?zárvaKedd(Ma)?zárvaSzerda(Ma)?15:00–21:00/.test(rows[0].text) && /Vasárnap(Ma)?11:00–20:00/.test(rows[0].text), 'Tavern Debrecen: napról napra, a zárt napokkal');
  ok(rows.every(r => /Nyitva|nyit|Zárva/.test(r.text)), 'a sorban a mostani állapot is (nyitva / mikor nyit)');
  ok(!(await p.$('#boltok [class*="today"]')), 'nincs külön „csak a mai nap” sor');
  const short = await p.evaluate(() => { const txt = document.querySelector('main').textContent; return (txt.match(/(?<!Tavern )\b(Debrecen|Miskolc) \d{1,2}:\d{2}/g) || []); });
  ok(short.length === 0, `sehol nincs rövidített boltnév nyitvatartással (${short.join(', ')})`);
  ok(await p.evaluate(() => [...document.querySelectorAll('footer a[data-table]')].some(a => a.textContent === 'Asztalfoglalás')), 'a láblécben is ott az Asztalfoglalás link');

  // kattintás: lámpa, felbillenő tábla, utána a beépített foglalás
  await p.$eval('[data-asztalfoglalas]', el => el.scrollIntoView({ block: 'center' }));
  await wait(600);
  await p.screenshot({ path: `${SHOTS}asztalfoglalas-blokk.jpg`, quality: 60 });
  const btn = await (await p.$('[data-asztalfoglalas] a[data-table]')).boundingBox();
  await p.mouse.click(btn.x + btn.width / 2, btn.y + btn.height / 2);
  await wait(350);
  const mid = await p.$eval(DLG, d => ({ hidden: d.hidden, anim: getComputedStyle(d.querySelector('[class*="tentFly"]')).animationName }));
  ok(!mid.hidden && /tentIn/.test(mid.anim), `nyitáskor felbillen a „Foglalt” tábla (${mid.anim})`);
  await p.screenshot({ path: `${SHOTS}asztalfoglalas-tabla.jpg`, quality: 60 });
  await wait(1900);
  const open = await p.$eval(DLG, d => ({ src: d.querySelector('iframe')?.getAttribute('src') || '', clip: getComputedStyle(d.querySelector('[class*="tableSheet"]')).clipPath, focus: d.contains(document.activeElement) }));
  ok(/\/asztalfoglalas\?embed=1$/.test(open.src), `utána a beépített asztalfoglalás nyílik (${open.src})`);
  ok(/inset\(0(px)?( round 0(px)?)?\)/.test(open.clip) || open.clip === 'none', `a foglalás a táblából teljesen kinyílt (${open.clip})`);
  ok(open.focus, 'a fókusz az ablakban');
  await p.screenshot({ path: `${SHOTS}asztalfoglalas-ablak.jpg`, quality: 60 });
  await p.keyboard.press('Escape');
  await wait(1200);
  ok(await p.$eval(DLG, d => d.hidden), 'Esc-re bezárul');
  ok(!(await p.evaluate(() => document.documentElement.className.includes('lock'))), 'bezárás után görgethető az oldal');

  // boltonkénti link
  await p.$eval('[data-asztalfoglalas] a[href$="bolt=miskolc"]', a => a.click());
  await wait(1600);
  ok(/bolt=miskolc&embed=1$/.test(await p.$eval(`${DLG} iframe`, f => f.getAttribute('src'))), 'a bolt linkje a bolttal együtt nyílik');

  // csökkentett mozgás: nincs tábla, rögtön nyílik
  const r = await page(b, null);
  await r.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await r.goto(`${BASE}/weblapteszt`, { waitUntil: 'networkidle2' });
  await r.$eval('[data-asztalfoglalas] a[data-table]', a => a.click());
  await wait(200);
  ok(await r.$eval(DLG, d => !d.hidden && getComputedStyle(d.querySelector('[class*="tentFly"]')).display === 'none' && getComputedStyle(d.querySelector('[class*="tableSheet"]')).opacity === '1'), 'csökkentett mozgásnál a tábla nélkül, rögtön nyílik');

  // telefon
  const ph = await page(b, null, 402, 874);
  await ph.goto(`${BASE}/weblapteszt`, { waitUntil: 'networkidle2' });
  ok((await ph.evaluate(() => document.documentElement.scrollWidth)) === 402, 'telefonon nincs vízszintes görgetés');
  const small = await ph.$$eval('[data-asztalfoglalas] a', as => as.filter(a => a.getBoundingClientRect().height < 44).length);
  ok(small === 0, 'telefonon a gombok legalább 44 px');
  await ph.$eval('[data-asztalfoglalas]', el => el.scrollIntoView({ block: 'start' }));
  await wait(700);
  await ph.screenshot({ path: `${SHOTS}asztalfoglalas-telefon.jpg`, quality: 60, fullPage: false });
  await ph.$eval('[data-asztalfoglalas] a[data-table]', a => a.click());
  await wait(2400);
  const box = await ph.$eval(`${DLG} [class*="tableSheet"]`, e => { const r = e.getBoundingClientRect(); return [r.width, r.height]; });
  ok(box[0] === 402 && box[1] === 874, `telefonon teljes képernyős ablak (${box.join('×')})`);

  // a mentett tartalom sem írhatja át a bolt nevét
  await db.collection('website_content').replaceOne({ _id: 'site' }, { stores: { debrecen: { name: 'Debreceni bolt' } } }, { upsert: true });
  const nm = await page(b, null);
  await nm.goto(`${BASE}/weblapteszt`, { waitUntil: 'networkidle2' });
  ok((await nm.$eval('#boltok a[data-map] h3', h => h.textContent)) === 'Tavern Debrecen', 'mentett más név helyett is Tavern Debrecen');
  await db.collection('website_content').deleteOne({ _id: 'site' });
  await nm.screenshot({ path: `${SHOTS}boltok-nyitvatartas.jpg`, quality: 60, clip: await nm.$eval('#boltok', el => { const r = el.getBoundingClientRect(); return { x: 0, y: r.top + scrollY, width: r.width, height: Math.min(r.height, 1100) }; }) });
  await ph.keyboard.press('Escape');
  await wait(1200);
  await ph.$eval('#boltok a[data-map]', el => el.scrollIntoView({ block: 'start' }));
  await wait(900);
  await ph.screenshot({ path: `${SHOTS}boltok-nyitvatartas-telefon.jpg`, quality: 60 });

  // a beépített oldal maga (helyben): nagy fejléc nélkül, a bolt előre kiválasztva
  const em = await page(b, null, 402, 780);
  await em.goto(`${BASE}/asztalfoglalas?bolt=debrecen&embed=1`, { waitUntil: 'networkidle2' });
  const e1 = await em.evaluate(() => ({ h1: document.querySelector('header')?.getBoundingClientRect().height, checked: document.querySelector('input[value="debrecen"]')?.checked, h: document.documentElement.scrollHeight }));
  await em.goto(`${BASE}/asztalfoglalas?bolt=debrecen`, { waitUntil: 'networkidle2' });
  const full = await em.evaluate(() => document.documentElement.scrollHeight);
  ok(e1.h1 <= 1 && e1.checked, 'beépítve: nincs nagy fejléc, a bolt előre kiválasztva');
  await em.goto(`${BASE}/asztalfoglalas?bolt=debrecen&embed=1`, { waitUntil: 'networkidle2' });
  await em.screenshot({ path: `${SHOTS}asztalfoglalas-beepitve.jpg`, quality: 60, fullPage: true });
  ok(e1.h < full, `beépítve rövidebb (${e1.h} < ${full} px)`);
  console.log('  böngészőhibák:', [...p.errs, ...ph.errs, ...r.errs].join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
