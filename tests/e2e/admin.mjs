// Admin (a látványterv szerint, Tavern-arculat): telítettségsáv a kártyákon és a táblázatban, állapotcímke, MA jelölés,
// kiemelt Check-in gomb, telítettség az esemény alsó lapján, helyszám-léptető a foglalásnál, ikonok a Továbbiak fülön.
import { openDb, token, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';

const { client, db } = await openDb();
const owner = (await db.collection('users').insertOne({ username: 'Tulaj', email: 'o@x.hu', password: 'x', role: 'owner', lastSeenChangelog: '9999' })).insertedId;
const pad = (n) => String(n).padStart(2, '0');
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
await db.collection('tournaments').insertMany([
  { name: 'Pokémon Liga', date: `${day(0)}T23:30`, category: 'Pokémon TCG', store: 'debrecen', max_players: 16, current_players: 16, queue_count: 3, is_open: true, createdAt: new Date() },
  { name: 'Commander este', date: `${day(0)}T23:45`, category: 'Magic: The Gathering', store: 'miskolc', max_players: 20, current_players: 9, is_open: false, createdAt: new Date() },
  { name: 'Lorcana kezdő', date: `${day(0)}T23:50`, category: 'Disney Lorcana', store: 'debrecen', max_players: 24, current_players: 18, queue_count: 2, is_open: true, createdAt: new Date() },
  { name: 'Külső verseny', date: `${day(0)}T23:55`, category: 'Riftbound', store: 'debrecen', external_url: 'https://example.com/verseny', max_players: 0, is_open: true, createdAt: new Date() },
]);
await db.collection('table_bookings').insertOne({ store: 'debrecen', date: day(4), from: '14:00', to: '18:00', name: 'Horváth Gergő', phone: '+36301234567', email: 'g@x.hu', maxPeople: 6, note: 'Két asztal kellene.', status: 'pending', createdAt: new Date() });
const tok = await token(owner, 'Tulaj', 'owner');
const tab = (p, label) => p.evaluate((l) => [...document.querySelectorAll('nav[aria-label="Admin"] button')].find(b => b.textContent.includes(l)).click(), label);

const b = await browser();
try {
  const p = await page(b, tok, 402, 874);
  await p.goto(`${BASE}/admin`, { waitUntil: 'networkidle2', timeout: 240000 });
  await p.waitForFunction(() => document.body.innerText.includes('Pokémon Liga'), { timeout: 60000 });
  await wait(500);

  // Események: kártyák
  const cards = await p.$$eval('[data-kartya]', els => els.map(e => ({ text: e.innerText, bar: !!e.querySelector('[data-sav]'), main: (() => { const x = [...e.querySelectorAll('a, button')].find(y => y.textContent.trim() === 'Check-in'); return x ? getComputedStyle(x).backgroundColor : null; })() })));
  ok(cards.length >= 2 && cards.filter(c => !/Külső/.test(c.text)).every(c => c.bar), 'kártyák: telítettségsáv minden létszámos versenyen');
  ok(cards.some(c => /Betelt/.test(c.text)) && cards.some(c => /Lezárva/.test(c.text)), 'kártyák: állapotcímke (Betelt, Lezárva)');
  ok(cards.some(c => /3 vár/.test(c.text)), 'kártyák: várólista száma');
  ok(cards.some(c => c.main && c.main !== 'rgba(0, 0, 0, 0)' && c.main !== 'rgb(42, 32, 34)'), 'kártyák: a Check-in a kiemelt gomb');
  ok(await p.evaluate(() => /MA/.test(document.querySelector('[data-ma]')?.textContent || '')), 'a mai nap „MA” jelöléssel');
  ok(await p.evaluate(() => document.querySelector('[data-ma]')?.getAttribute('aria-hidden') === 'true'), 'a „MA” jelölést a felolvasó nem mondja kétszer');
  ok(cards.some(c => /Commander este/.test(c.text) && /Lezárva/.test(c.text) && !/hely szabad/.test(c.text)), 'lezárt eseményen nincs „hely szabad”');
  ok(cards.some(c => /Külső verseny/.test(c.text) && (c.text.match(/külső jelentkezés/gi) || []).length === 1), 'külső jelentkezésnél nincs dupla felirat');
  ok((await p.evaluate(() => document.documentElement.scrollWidth)) === 402, 'telefonon nincs vízszintes görgetés');
  await p.screenshot({ path: `${SHOTS}admin-esemenyek.jpg`, quality: 60 });

  // Egy esemény alsó lapja
  await p.evaluate(() => [...document.querySelectorAll('[data-kartya] button')].find(x => x.textContent.includes('Pokémon Liga')).click());
  await wait(700);
  ok(await p.evaluate(() => !!document.querySelector('.ant-drawer-open [data-sav]') && /Betelt/.test(document.querySelector('.ant-drawer-open')?.innerText || '')), 'alsó lap: telítettségkártya');
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.ant-drawer-open [data-sav] > span')).backgroundColor === 'rgb(229, 177, 93)'), 'alsó lap: a sáv arany (a portálban is)');
  await p.screenshot({ path: `${SHOTS}admin-lap.jpg`, quality: 60 });
  await p.keyboard.press('Escape');
  await wait(500);
  await p.evaluate(() => [...document.querySelectorAll('[data-kartya] button')].find(x => x.textContent.includes('Lorcana kezdő')).click());
  await wait(700);
  ok(await p.evaluate(() => /2 várólistán/.test(document.querySelector('.ant-drawer-open')?.innerText || '')), 'alsó lap: a várólista akkor is látszik, ha nincs tele');
  await p.keyboard.press('Escape');
  await wait(500);

  // Foglalások: helyszám-léptető
  await tab(p, 'Foglalások');
  await p.waitForFunction(() => document.body.innerText.includes('Horváth Gergő'), { timeout: 10000 });
  const v0 = await p.$eval('input[aria-label="Foglalt helyek száma"]', i => i.value);
  await p.click('button[aria-label="Eggyel több hely"]');
  const v1 = await p.$eval('input[aria-label="Foglalt helyek száma"]', i => i.value);
  await p.click('button[aria-label="Eggyel kevesebb hely"]');
  await p.click('button[aria-label="Eggyel kevesebb hely"]');
  const v2 = await p.$eval('input[aria-label="Foglalt helyek száma"]', i => i.value);
  ok(v0 === '6' && v1 === '7' && v2 === '5', `foglalás: −/+ léptető (${v0} → ${v1} → ${v2})`);
  const stepH = await p.$eval('button[aria-label="Eggyel több hely"]', x => x.getBoundingClientRect().height);
  ok(stepH >= 44, 'foglalás: a léptető gombjai legalább 44 px');
  ok((await p.$eval('input[aria-label="Foglalt helyek száma"]', x => x.getBoundingClientRect().height)) >= 44, 'foglalás: a helyszám mezője is legalább 44 px');
  await p.screenshot({ path: `${SHOTS}admin-foglalasok.jpg`, quality: 60 });

  // Továbbiak: ikonok
  await tab(p, 'Továbbiak');
  await wait(400);
  const rows = await p.$$eval('[data-eszkoz]', els => els.map(e => !!e.querySelector('svg')));
  ok(rows.length >= 8 && rows.every(Boolean), `Továbbiak: minden sorban ikon (${rows.length} sor)`);
  await p.screenshot({ path: `${SHOTS}admin-tovabbiak.jpg`, quality: 60 });

  // Gép: táblázat
  const d = await page(b, tok, 1440, 900);
  await d.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
  await d.waitForFunction(() => document.body.innerText.includes('Pokémon Liga'), { timeout: 60000 });
  await wait(400);
  ok((await d.$$eval('table tr [data-sav]', e => e.length)) >= 2, 'gép: telítettségsáv a táblázatban');
  const pillBg = (pg, sel) => pg.evaluate((q) => { const x = [...document.querySelectorAll(q)].find(e => e.textContent.trim() === 'Betelt' && e.offsetParent); return x ? getComputedStyle(x).backgroundColor : null; }, sel);
  const phonePill = await pillBg(p, '[data-kartya] span').catch(() => null);
  ok(await pillBg(d, 'table span') === 'rgb(51, 40, 26)', 'gép: a „Betelt” címke színe ugyanaz, mint telefonon');
  await d.screenshot({ path: `${SHOTS}admin-gep.jpg`, quality: 60 });
  console.log('  böngészőhibák:', [...p.errs, ...d.errs].join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
