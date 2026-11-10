// 4. pont: heti nézet, eseményoldal, jelentkezési oldal az új kinézettel.
import { openDb, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';

const { client, db } = await openDb();
const pad = (n) => String(n).padStart(2, '0');
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const ev = (offset, time, name, category, max) => ({ name, date: `${day(offset)}T${time}`, category, store: 'debrecen', max_players: max, current_players: 0, is_open: true, description: 'Hozd a paklidat!', createdAt: new Date() });
const ids = (await db.collection('tournaments').insertMany([
  ev(1, '17:30', 'One Piece Store Tournament', 'One Piece Card Game', 20),
  ev(2, '18:00', 'Pokémon Liga', 'Pokémon TCG', 16),
])).insertedIds;
const opId = String(ids[0]);
const EMOJI = /\p{Extended_Pictographic}/u;
const small = (p) => p.evaluate(() => [...document.querySelectorAll('main button, main a, main input')]
  .filter(e => e.offsetParent && e.getBoundingClientRect().height > 1)
  .filter(e => { const r = e.getBoundingClientRect(); return r.height < 44; })
  .map(e => `${e.tagName}:${(e.getAttribute('aria-label') || e.textContent || e.name || '').trim().slice(0, 18)} ${Math.round(e.getBoundingClientRect().height)}`));

const b = await browser();
try {
  // Heti nézet (telefon)
  let p = await page(b, null, 402, 874);
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 240000 });
  await p.waitForFunction(() => [...document.querySelectorAll('button')].some(e => e.textContent.includes('Megnyitom')), { timeout: 240000 });
  await p.evaluate(() => [...document.querySelectorAll('button')].find(e => e.textContent.includes('Tavern Debrecen')).click());
  await p.waitForSelector('[aria-label="Nézet"] button');
  await p.evaluate(() => [...document.querySelectorAll('[aria-label="Nézet"] button')].find(x => x.textContent.trim() === 'Heti').click());
  await wait(800);
  ok(!!(await p.$('[data-het]')), 'heti: új heti nézet');
  ok((await p.$$('[data-het] [data-ujsor] [data-sav]')).length >= 1, 'heti: ugyanazok az eseménysorok, telítettségsávval');
  ok(await p.evaluate(() => /Ma/.test(document.querySelector('[data-het] [data-ma]')?.textContent || '')), 'heti: a mai nap jelölve');
  ok(await p.evaluate(() => [...document.querySelectorAll('[data-het] [data-ures]')].length >= 1), 'heti: az üres napok egy rövid sorban');
  const s1 = await small(p);
  ok(s1.length === 0, `heti: minden vezérlő legalább 44 px (${s1.slice(0, 4).join(' | ')})`);
  await p.click('[data-het] button[aria-label="Következő hét"]');
  await wait(300);
  ok(await p.evaluate(() => [...document.querySelectorAll('[data-het] button')].some(x => x.textContent.trim() === 'Ez a hét')), 'heti: másik héten „Ez a hét” gomb');
  ok((await p.evaluate(() => document.documentElement.scrollWidth)) === 402, 'heti: nincs vízszintes görgetés');
  await p.click('[data-het] button[aria-label="Előző hét"]');
  await wait(300);
  await p.screenshot({ path: `${SHOTS}t7-heti.jpg`, quality: 60, fullPage: true });

  // Eseményoldal (telefon)
  p = await page(b, null, 402, 874);
  await p.goto(`${BASE}/esemeny/${opId}`, { waitUntil: 'networkidle2', timeout: 240000 });
  await wait(500);
  ok(await p.evaluate(() => /Cinzel/i.test(getComputedStyle(document.querySelector('h1')).fontFamily)), 'esemény: Cinzel cím');
  ok(!!(await p.$('[data-sav]')) && await p.evaluate(() => document.body.innerText.includes('hely szabad')), 'esemény: telítettségsáv, szabad helyek');
  const join = await p.evaluate(() => { const x = [...document.querySelectorAll('button, a')].find(e => e.textContent.trim() === 'Jelentkezem'); if (!x) return null; const r = x.getBoundingClientRect(); return { bottom: r.bottom, h: r.height }; });
  ok(join && join.bottom <= 874 && join.h >= 48, 'esemény: a Jelentkezem gomb görgetés nélkül is látszik');
  const s2 = await small(p);
  ok(s2.length === 0, `esemény: minden vezérlő legalább 44 px (${s2.slice(0, 4).join(' | ')})`);
  ok(!EMOJI.test(await p.evaluate(() => document.body.innerText)), 'esemény: nincs emoji ikon');
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('main')).backgroundColor === 'rgb(15, 11, 12)'), 'esemény: a naptár háttérszíne');
  await p.screenshot({ path: `${SHOTS}t7-esemeny.jpg`, quality: 60, fullPage: true });

  // Jelentkezési oldal (telefon)
  p = await page(b, null, 402, 874);
  await p.goto(`${BASE}/jelentkezes/${opId}`, { waitUntil: 'networkidle2', timeout: 240000 });
  ok(!!(await p.$('[data-sav]')), 'jelentkezés: telítettségsáv');
  await p.evaluate(() => [...document.querySelectorAll('button')].find(x => x.type === 'submit').click());
  await wait(200);
  ok(await p.evaluate(() => { const u = document.querySelector('input[autocomplete="nickname"]'); const id = u.getAttribute('aria-describedby'); return u.getAttribute('aria-invalid') === 'true' && !!id && !!document.getElementById(id.split(' ').find(x => x.startsWith('hiba')) || ''); }), 'jelentkezés: a hiba a mezőhöz kötve (aria-invalid, aria-describedby)');
  const s3 = await small(p);
  ok(s3.length === 0, `jelentkezés: minden vezérlő legalább 44 px (${s3.slice(0, 4).join(' | ')})`);
  await p.screenshot({ path: `${SHOTS}t7-jelentkezes.jpg`, quality: 60, fullPage: true });
  await p.type('input[autocomplete="nickname"]', 'Tesztelek');
  await p.type('input[autocomplete="name"]', 'Teszt Elek');
  await p.type('input[autocomplete="email"]', 'teszt@example.hu');
  await p.evaluate(() => [...document.querySelectorAll('button')].find(x => x.type === 'submit').click());
  await p.waitForFunction(() => /Hely biztosítva|Várólistára/.test(document.body.innerText), { timeout: 20000 }).catch(() => {});
  const txt = await p.evaluate(() => document.body.innerText);
  ok(/Hely biztosítva/.test(txt) && !EMOJI.test(txt) && !!(await p.$('main svg')), 'jelentkezés: siker SVG ikonnal, emoji nélkül');
  await p.screenshot({ path: `${SHOTS}t7-siker.jpg`, quality: 60 });
  console.log('  böngészőhibák:', p.errs.join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
