// Weboldal: az Előrendelés mezőben az élő (nyitott) előrendelések; kattintásra animáció, utána a naptárablakban az előrendelés.
import { openDb, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';

const { client, db } = await openDb();
const SEL = '[data-elorendelesek]';
const b = await browser();
try {
  let p = await page(b, null);
  await p.goto(`${BASE}/weblapteszt`, { waitUntil: 'networkidle2', timeout: 240000 });
  ok(!(await p.$(SEL)), 'nyitott előrendelés nélkül nincs kártyasor');

  const ids = (await db.collection('preorder_products').insertMany([
    { name: 'Mega Evolution Booster Box', category: 'Pokémon TCG', price: 52990, releaseDate: '2026. december 5.', stock: 40, isOpen: true, createdAt: new Date() },
    { name: 'OP-14 Booster Display', category: 'One Piece Card Game', price: 44990, releaseDate: '2026. november 28.', stock: 3, isOpen: true, createdAt: new Date(Date.now() - 1000) },
    { name: 'Régi, lezárt termék', category: 'Disney Lorcana', price: 1000, isOpen: false, createdAt: new Date() },
  ])).insertedIds;
  await p.goto(`${BASE}/weblapteszt`, { waitUntil: 'networkidle2' });
  const cards = await p.$$eval(`${SEL} [data-elorendeles]`, els => els.map(e => ({ text: e.textContent, href: e.getAttribute('href'), dot: getComputedStyle(e.querySelector('[data-elo]')).animationName })));
  ok(cards.length === 2, `a két nyitott előrendelés kártyája (${cards.length})`);
  ok(cards.some(c => /Mega Evolution Booster Box/.test(c.text) && /52\s990\sFt/.test(c.text) && /december 5/.test(c.text)), 'név, ár, megjelenés');
  ok(cards.every(c => /ÉLŐ/i.test(c.text) && c.dot !== 'none'), 'lüktető „ÉLŐ” jelzés');
  ok(cards.some(c => /OP-14/.test(c.text) && /Utolsó darabok/i.test(c.text)), 'kevés darabnál „Utolsó darabok!”');
  ok(cards.some(c => c.href.endsWith(`/elorendeles?termek=${ids[0]}`)), 'a kártya az adott termék előrendelésére visz');

  // kattintás: szikrák és animáció, utána a naptárablak az előrendeléssel
  await p.$eval(SEL, el => el.scrollIntoView({ block: 'center' }));
  await wait(600);
  const card = await p.$(`${SEL} [data-elorendeles]`);
  const box = await card.boundingBox();
  await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await wait(120);
  ok((await p.$$(`${SEL} [data-szikra]`)).length >= 8 && await p.$eval(`${SEL} [data-elorendeles]`, e => e.hasAttribute('data-indul')), 'kattintásra szikrák és indulás-animáció');
  await p.screenshot({ path: `${SHOTS}elorendeles-katt.jpg`, quality: 60 });
  await wait(1600);
  const src = await p.evaluate(() => document.querySelector('[role="dialog"]:not([hidden]) iframe')?.getAttribute('src') || '');
  ok(/\/elorendeles\?termek=/.test(src), `utána a naptárablakban az előrendelés (${src})`);
  ok(/[?&]embed=1/.test(src), 'a naptárablak a beépített (kompakt) előrendelést nyitja');

  // csökkentett mozgás: nincs animáció, rögtön nyílik
  const r = await page(b, null);
  await r.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await r.goto(`${BASE}/weblapteszt`, { waitUntil: 'networkidle2' });
  await r.$eval(SEL, el => el.scrollIntoView({ block: 'center' }));
  await wait(300);
  const rb = await (await r.$(`${SEL} [data-elorendeles]`)).boundingBox();
  await r.mouse.click(rb.x + rb.width / 2, rb.y + rb.height / 2);
  await wait(100);
  ok((await r.$$(`${SEL} [data-szikra]`)).length === 0, 'csökkentett mozgásnál nincs szikra');
  await wait(1200);
  ok(/\/elorendeles\?termek=/.test(await r.evaluate(() => document.querySelector('[role="dialog"]:not([hidden]) iframe')?.getAttribute('src') || '')), 'csökkentett mozgásnál is nyílik');

  // telefon
  const ph = await page(b, null, 402, 874);
  await ph.goto(`${BASE}/weblapteszt`, { waitUntil: 'networkidle2' });
  ok((await ph.evaluate(() => document.documentElement.scrollWidth)) === 402, 'telefonon nincs vízszintes görgetés');
  await ph.$eval(SEL, el => el.scrollIntoView({ block: 'center' }));
  await wait(800);
  await ph.screenshot({ path: `${SHOTS}elorendeles-telefon.jpg`, quality: 60 });
  console.log('  böngészőhibák:', [...p.errs, ...ph.errs].join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
