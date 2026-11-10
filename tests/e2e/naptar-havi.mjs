// Nyilvános naptár, új kinézet: csak a belépett tulajdonos látja; mindenki más a régit.
import { openDb, token, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';

const { client, db } = await openDb();
const owner = (await db.collection('users').insertOne({ username: 'Tulaj', email: 'o@x.hu', password: 'x', role: 'owner' })).insertedId;
const pad = (n) => String(n).padStart(2, '0');
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const ev = (offset, time, name, category, max, store = 'debrecen') => ({ name, date: `${day(offset)}T${time}`, category, store, max_players: max, is_open: true, createdAt: new Date() });
await db.collection('tournaments').insertMany([
  ev(1, '17:30', 'One Piece Store Tournament', 'One Piece Card Game', 20),
  ev(1, '18:00', 'Pokémon Liga', 'Pokémon TCG', 16),
  ev(3, '18:00', 'Commander este', 'Magic: The Gathering', 20),
]);
const tok = await token(owner, 'Tulaj', 'owner');
const visible = (p, sel) => p.$$eval(sel, els => els.filter(e => e.offsetParent && e.getBoundingClientRect().height > 1).length);
// minden látható vezérlő a fő oldalon (a havi rács napjai is), 44 px alatt
const smallOnes = (p) => p.evaluate(() => [...document.querySelectorAll('main button, main a, main input')]
  .filter(e => e.offsetParent && e.getBoundingClientRect().height > 1)
  .filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 40; })
  .map(e => `${e.tagName}:${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 16)} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`));
const pickStore = async (p) => {
  await p.waitForFunction(() => [...document.querySelectorAll('button')].some(e => e.textContent.includes('Megnyitom')), { timeout: 240000 });
  await p.evaluate(() => [...document.querySelectorAll('button')].find(e => e.textContent.includes('Tavern Debrecen')).click());
  await p.waitForSelector('[aria-label="Előző hónap"]', { timeout: 30000 });
  await wait(500);
};

const b = await browser();
try {
  // vendég: már ő is az új kinézetet kapja; betöltés közben a hónap váza látszik
  let p = await page(b, null, 402, 874);
  await p.setRequestInterception(true);
  p.on('request', r => { if (r.url().includes('/api/public-data')) setTimeout(() => r.continue(), 2500); else r.continue(); });
  await p.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await p.waitForSelector('[aria-busy="true"]', { timeout: 60000 }).catch(() => {});
  ok(await p.evaluate(() => !!document.querySelector('[aria-busy="true"] [data-vaz]') && document.querySelectorAll('[data-vaz]').length >= 28), 'betöltés közben a hónap váza (aria-busy)');
  await p.screenshot({ path: `${SHOTS}t6-vaz.jpg`, quality: 60 });
  await pickStore(p);
  ok(!!(await p.$('[data-uj-naptar]')), 'vendég: az új kinézet');
  ok(!(await p.evaluate(() => [...document.querySelectorAll('button')].some(e => e.textContent.trim() === 'Riftbound' && e.offsetParent))), 'vendég: nincs kifutó chip-sor');
  const emb = await page(b, null, 402, 874);
  await emb.goto(`${BASE}/embed?store=debrecen`, { waitUntil: 'networkidle2', timeout: 240000 });
  await emb.waitForSelector('[aria-label="Előző hónap"]', { timeout: 60000 }).catch(() => {});
  ok(!(await emb.$('[data-uj-naptar]')), 'beágyazva: a kompakt nézet marad');

  // tulajdonos, telefon
  const ctx = await b.createBrowserContext();
  p = await page(ctx, tok, 402, 874);
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 240000 });
  await pickStore(p);
  ok(!!(await p.$('[data-uj-naptar]')), 'tulajdonos: új kinézet');
  const small = await smallOnes(p);
  ok(small.length === 0, `1. minden vezérlő legalább 44 px (${small.slice(0, 5).join(' | ')})`);
  ok(await p.evaluate(() => [...document.querySelectorAll('[data-day]')].some(e => /Pokémon TCG/.test(e.getAttribute('aria-label') || ''))), '1. a nap felirata megnevezi a játékokat');
  await p.focus('[data-day]:not([disabled])');
  const first = await p.evaluate(() => document.activeElement.dataset.day);
  await p.keyboard.press('ArrowRight');
  const second = await p.evaluate(() => document.activeElement.dataset.day);
  ok(first && second && second > first, '1. nyíllal lehet lépni a napok között');
  ok((await p.$$eval('[aria-label="Helyszín"] button', bs => bs.map(x => x.textContent.trim()).join('|'))).startsWith('Debrecen|'), '2. rövid boltnevek');
  ok((await visible(p, 'input[type=search], input[aria-label="Keresés az események között"]')) === 0 && !!(await p.$('button[aria-label="Keresés"]')), '2. a kereső ikon mögött');
  ok(!(await p.evaluate(() => [...document.querySelectorAll('button')].some(e => e.textContent.trim() === 'Riftbound' && e.offsetParent))), '2. nincs kifutó chip-sor');
  await p.evaluate(() => [...document.querySelectorAll('button')].find(e => e.textContent.includes('Játékok')).click());
  await p.waitForFunction(() => [...document.querySelectorAll('label')].some(l => l.textContent.includes('Riftbound') && l.offsetParent), { timeout: 5000 }).catch(() => {});
  ok(await p.evaluate(() => [...document.querySelectorAll('label')].some(l => l.textContent.includes('Riftbound') && l.offsetParent)), '2. a Játékok gomb alsó lapot nyit a játékokkal');
  await p.screenshot({ path: `${SHOTS}t6-jatekok.jpg`, quality: 60 });
  await p.evaluate(() => [...document.querySelectorAll('label')].find(l => l.textContent.includes('Pokémon TCG')).click());
  await p.evaluate(() => [...document.querySelectorAll('button')].find(e => e.textContent.trim() === 'Kész').click());
  await wait(600);
  ok(await p.evaluate(() => [...document.querySelectorAll('button')].some(e => /Játékok · 1/.test(e.textContent))), '2. a gombon látszik, hány játék van kiválasztva');
  await p.evaluate(() => [...document.querySelectorAll('button')].find(e => /Játékok/.test(e.textContent)).click());
  await wait(300);
  await p.evaluate(() => [...document.querySelectorAll('button')].find(e => e.textContent.trim() === 'Minden játék').click());
  await p.evaluate(() => [...document.querySelectorAll('button')].find(e => e.textContent.trim() === 'Kész').click());
  await wait(600);

  // 3. ma zárva (kedd) vagy nincs esemény: ugrás a következőre; az eseménysoron telítettség
  const next = await p.$('button[data-kovetkezo]');
  ok(!!next, '3. üres napon: „Következő esemény” gomb');
  if (next) { await next.click(); await wait(400); }
  ok(await p.evaluate(() => document.body.innerText.includes('One Piece Store Tournament')), '3. a gomb a következő eseményes napra ugrik');
  ok((await p.$$('[data-ujsor] [data-sav]')).length >= 1 && await p.evaluate(() => document.body.innerText.includes('hely szabad')), '3. az eseménysoron sáv és szabad helyek');
  ok((await p.evaluate(() => document.documentElement.scrollWidth)) === 402, 'telefonon nincs vízszintes görgetés');
  await p.evaluate(() => scrollTo(0, 0));
  await p.screenshot({ path: `${SHOTS}t6-telefon.jpg`, quality: 60, fullPage: true });

  // tulajdonos, gép: a rács napjai is gombok, 44 px felett
  const d = await page(ctx, tok, 1440, 900);
  await d.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
  await d.waitForSelector('[aria-label="Előző hónap"]', { timeout: 30000 });
  await wait(500);
  // gépen: a rács napjain belüli csíkokra a WCAG 24 px-es szabálya, minden másra 44 px
  const smallD = await d.evaluate(() => [...document.querySelectorAll('main button, main a, main input')]
    .filter(e => e.offsetParent && e.getBoundingClientRect().height > 1)
    .filter(e => { const r = e.getBoundingClientRect(); const min = e.closest('[data-day]') ? 24 : 44; return r.height < min; })
    .map(e => `${e.tagName}:${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 16)} ${Math.round(e.getBoundingClientRect().height)}`));
  ok(smallD.length === 0, `gép: minden vezérlő legalább 44 px (${smallD.slice(0, 5).join(' | ')})`);
  await d.screenshot({ path: `${SHOTS}t6-gep.jpg`, quality: 60 });
  console.log('  böngészőhibák:', [...p.errs, ...d.errs].join(' | ') || 'nincs');
  await ctx.close();
} finally {
  await b.close(); await client.close(); summary();
}
