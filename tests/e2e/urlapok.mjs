// A jelentkezési és az előrendelő űrlap új kinézete: úszó címke, ellenőrzés a mező elhagyásakor, pipa a jó mezőn,
// haladásjelző, hibaösszesítő, animált siker (pipa + konfetti, emoji nélkül), legalább 44 px, telefonon nincs vízszintes görgetés.
import { openDb, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';

const { client, db } = await openDb();
const pad = (n) => String(n).padStart(2, '0');
const day = (o) => { const d = new Date(); d.setDate(d.getDate() + o); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const evId = String((await db.collection('tournaments').insertOne({ name: 'One Piece Store Tournament', date: `${day(2)}T17:30`, category: 'One Piece Card Game', store: 'jatekceh', max_players: 20, current_players: 0, is_open: true })).insertedId);
const prodIds = (await db.collection('preorder_products').insertMany([
  { name: 'Mega Evolution Booster Box', category: 'Pokémon TCG', price: 52990, releaseDate: '2026. december 5.', stock: 40, perPersonLimit: 3, isOpen: true, createdAt: new Date() },
  { name: 'OP-14 Booster Display', category: 'One Piece Card Game', price: 44990, isOpen: true, createdAt: new Date(Date.now() - 1000) },
])).insertedIds;
const EMOJI = /\p{Extended_Pictographic}/u;
const small = (p) => p.evaluate(() => [...document.querySelectorAll('main button, main a, main input:not([type=checkbox]):not([tabindex="-1"])')]
  .filter(e => e.offsetParent && e.getBoundingClientRect().height > 1)
  .filter(e => e.getBoundingClientRect().height < 44)
  .map(e => `${e.tagName}:${(e.getAttribute('aria-label') || e.textContent || e.name || '').trim().slice(0, 16)} ${Math.round(e.getBoundingClientRect().height)}`));
const invalid = (p, sel) => p.$eval(sel, i => i.getAttribute('aria-invalid') === 'true');

const b = await browser();
try {
  // --- Jelentkezés ---
  let p = await page(b, null, 402, 874);
  await p.goto(`${BASE}/jelentkezes/${evId}`, { waitUntil: 'networkidle2', timeout: 240000 });
  const U = 'input[autocomplete="nickname"]', N = 'input[autocomplete="name"]', E = 'input[autocomplete="email"]';
  ok(await p.$eval(U, i => !!i.id && !!document.querySelector(`label[for="${i.id}"]`)), 'jelentkezés: minden mezőnek címkéje van');
  await p.type(E, 'rossz-cim');
  await p.focus(N);
  await wait(150);
  ok(await invalid(p, E), 'jelentkezés: a hibás e-mail már a mező elhagyásakor jelez');
  await p.$eval(E, i => { i.value = ''; });
  await p.type(E, 'teszt@example.hu');
  await p.focus(U);
  await wait(150);
  ok(!(await invalid(p, E)) && await p.$eval(E, i => !!i.closest('[data-mezo]')?.querySelector('[data-jo]')), 'jelentkezés: jó mezőn pipa');
  ok(!(await p.$('[data-haladas]')), 'jelentkezés: nincs „0/3 kész” haladásjelző');
  await p.evaluate(() => [...document.querySelectorAll('button')].find(x => x.type === 'submit').click());
  await wait(200);
  ok(await p.evaluate(() => { const s = document.querySelector('[data-hibak]'); return !!s && s.contains(document.activeElement) && s.querySelectorAll('a[href^="#"]').length === 2; }), 'jelentkezés: hibaösszesítő a hiányzó mezőkre, rá kerül a fókusz');
  ok(await invalid(p, U) && await p.$eval(U, i => (i.getAttribute('aria-describedby') || '').includes('hiba-')), 'jelentkezés: a hiba a mezőhöz kötve');
  const s1 = await small(p);
  ok(s1.length === 0, `jelentkezés: minden vezérlő legalább 44 px (${s1.slice(0, 4).join(' | ')})`);
  ok((await p.evaluate(() => document.documentElement.scrollWidth)) === 402, 'jelentkezés: nincs vízszintes görgetés');
  await p.screenshot({ path: `${SHOTS}urlap-jelentkezes.jpg`, quality: 60, fullPage: true });
  await p.type(U, 'Tesztelek');
  await p.type(N, 'Teszt Elek');
  await p.evaluate(() => [...document.querySelectorAll('button')].find(x => x.type === 'submit').click());
  await p.waitForFunction(() => /Hely biztosítva/.test(document.body.innerText), { timeout: 20000 }).catch(() => {});
  await wait(250);
  const txt = await p.evaluate(() => document.body.innerText);
  ok(/Hely biztosítva/.test(txt) && !EMOJI.test(txt) && !!(await p.$('[data-pipa]')), 'jelentkezés: siker kirajzolódó pipával, emoji nélkül');
  ok((await p.$$('[data-konfetti]')).length >= 10, 'jelentkezés: konfetti a sikernél');
  await p.screenshot({ path: `${SHOTS}urlap-jelentkezes-siker.jpg`, quality: 60 });

  // --- Előrendelés ---
  p = await page(b, null, 402, 874);
  await p.goto(`${BASE}/elorendeles`, { waitUntil: 'networkidle2', timeout: 240000 });
  ok(!EMOJI.test(await p.evaluate(() => document.body.innerText)), 'előrendelés: nincs emoji');
  const card = `[data-termek="${prodIds[0]}"]`;
  await p.click(card);
  await wait(250);
  ok(await p.$eval(`${card} input[type=checkbox]`, i => i.checked) && !!(await p.$(`${card} [aria-label="Több"]`)), 'előrendelés: az egész kártyára kattintva kiválasztható, megjelenik a léptető');
  await p.click(`${card} [aria-label="Több"]`);
  await wait(150);
  ok(await p.evaluate(() => /105\s980\sFt/.test(document.querySelector('[data-osszeg]')?.textContent || '')), 'előrendelés: a végösszeg frissül (2 × 52 990 = 105 980)');
  await p.type('input[autocomplete="tel"]', '12');
  await p.focus('input[autocomplete="name"]');
  await wait(150);
  ok(await invalid(p, 'input[autocomplete="tel"]'), 'előrendelés: a hibás telefonszám a mező elhagyásakor jelez');
  const sticky = await p.evaluate(() => { const x = document.querySelector('[data-osszeg]')?.closest('[data-sav-alul]'); return x ? getComputedStyle(x).position : null; });
  ok(sticky === 'sticky' || sticky === 'fixed', 'előrendelés: telefonon az összeg és a gomb alul ragad');
  const s2 = await small(p);
  ok(s2.length === 0, `előrendelés: minden vezérlő legalább 44 px (${s2.slice(0, 4).join(' | ')})`);
  ok((await p.evaluate(() => document.documentElement.scrollWidth)) === 402, 'előrendelés: nincs vízszintes görgetés');
  await p.screenshot({ path: `${SHOTS}urlap-elorendeles.jpg`, quality: 60, fullPage: true });
  await p.$eval('input[autocomplete="tel"]', i => { i.value = ''; });
  await p.type('input[autocomplete="tel"]', '+36 30 123 4567');
  await p.type('input[autocomplete="name"]', 'Teszt Elek');
  await p.type('input[autocomplete="email"]', 'teszt@example.hu');
  await p.evaluate(() => [...document.querySelectorAll('button')].find(x => x.type === 'submit').click());
  await p.waitForFunction(() => /megkaptuk/.test(document.body.innerText), { timeout: 20000 }).catch(() => {});
  await wait(250);
  const t2 = await p.evaluate(() => document.body.innerText);
  ok(/megkaptuk/.test(t2) && !EMOJI.test(t2) && !!(await p.$('[data-pipa]')) && (await p.$$('[data-konfetti]')).length >= 10, 'előrendelés: siker pipával és konfettivel, emoji nélkül');
  await p.screenshot({ path: `${SHOTS}urlap-elorendeles-siker.jpg`, quality: 60 });

  // linkek: játékra szóló (csak az a játék), termékre szóló, összesítő
  const names = (pg) => pg.$$eval('[data-termek]', els => els.map(e => e.querySelector('b')?.textContent || ''));
  const allLink = (pg) => pg.evaluate(() => [...document.querySelectorAll('a')].some(a => a.getAttribute('href') === '/elorendeles' && /Összes előrendelés/.test(a.textContent)));
  const g = await page(b, null, 402, 874);
  await g.goto(`${BASE}/elorendeles?jatek=pokemon-tcg`, { waitUntil: 'networkidle2' });
  const gn = await names(g);
  ok(gn.length === 1 && /Mega Evolution/.test(gn[0]) && /Pokémon TCG/.test(await g.evaluate(() => document.querySelector('header')?.textContent || '')), `játék link: csak a Pokémon előrendelései (${gn.join(', ')})`);
  ok(await allLink(g), 'játék link: „Összes előrendelés” link az összesítőre');
  await g.goto(`${BASE}/elorendeles?termek=${prodIds[1]}`, { waitUntil: 'networkidle2' });
  ok((await names(g)).length === 1 && await allLink(g), 'termék link: csak az a termék, és „Összes előrendelés” link');
  await g.goto(`${BASE}/elorendeles`, { waitUntil: 'networkidle2' });
  ok((await names(g)).length === 2 && !(await allLink(g)), 'összesítő: minden játék előrendelése látszik');
  await g.goto(`${BASE}/elorendeles?jatek=nincs-ilyen`, { waitUntil: 'networkidle2' });
  ok((await names(g)).length === 2, 'ismeretlen játék linkje: minden előrendelés látszik');

  // csökkentett mozgás: nincs konfetti
  const r = await page(b, null, 402, 874);
  await r.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await r.goto(`${BASE}/jelentkezes/${evId}`, { waitUntil: 'networkidle2' });
  await r.type('input[autocomplete="nickname"]', 'Masik');
  await r.type('input[autocomplete="name"]', 'Másik Ember');
  await r.type('input[autocomplete="email"]', 'masik@example.hu');
  await r.evaluate(() => [...document.querySelectorAll('button')].find(x => x.type === 'submit').click());
  await r.waitForFunction(() => /Hely biztosítva/.test(document.body.innerText), { timeout: 20000 }).catch(() => {});
  ok((await r.$$('[data-konfetti]')).length === 0, 'csökkentett mozgásnál nincs konfetti');
  console.log('  böngészőhibák:', [...p.errs, ...r.errs].join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
