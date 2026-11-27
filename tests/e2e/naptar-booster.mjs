// Nyilvános naptár, lassú (hideg)indítás: betöltés közben Tavern booster lebeg váltakozó szöveggel; amikor megjön az
// adat, letépődik a teteje és kijön belőle a naptár. Gyors betöltésnél nem jelenik meg; a réteg nem fogja el a kattintást.
// A booster helyett véletlenszerűen eldobott dobókocka is jöhet (window.__TAVERN_BETOLTO__ rögzíti a teszthez).
import { openDb, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';

const { client, db } = await openDb();
const pad = (n) => String(n).padStart(2, '0');
const d = new Date();
const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
await db.collection('tournaments').insertOne({ name: 'Pokémon klubnap', date: `${today}T23:30`, category: 'Pokémon TCG', store: 'debrecen', max_players: 16, current_players: 3, is_open: true, createdAt: new Date() });

const b = await browser();
try {
  // lassú adat: a nyilvános adat 4 mp múlva érkezik
  const p = await page(b, null, 402, 874);
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem('tavern_selected_store', 'debrecen'); } catch { /* */ } window.__TAVERN_BETOLTO__ = 'booster'; });
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 240000 }); // első fordítás
  await p.setRequestInterception(true);
  p.on('request', (req) => { if (req.url().includes('/api/public-data')) setTimeout(() => req.continue().catch(() => {}), 4000); else req.continue().catch(() => {}); });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await wait(1000);
  ok(!(await p.$('[data-booster]')), '1 mp-ig nincs booster (csak a lassú betöltésnél jön)');
  await wait(1000);
  const pack = await p.evaluate(() => { const el = document.querySelector('[data-booster]'); return el ? { phase: el.dataset.booster, text: el.innerText, logo: !!el.querySelector('img[src*="tavern-ceger"]'), clickThrough: getComputedStyle(el).pointerEvents === 'none' } : null; });
  ok(pack?.clickThrough, 'a booster rétege nem fogja el a kattintást');
  ok(pack?.phase === 'pack' && pack.logo && /Keverjük|asztal|lapokat|program|kezdünk/.test(pack.text), `lassú betöltésnél Tavern booster, élénkítő szöveggel (${pack?.text?.replace(/\n/g, ' ')})`);
  await p.screenshot({ path: `${SHOTS}naptar-booster.jpg`, quality: 60 });
  const l1 = await p.$eval('[data-booster] p', el => el.textContent);
  await wait(1850);
  const l2 = await p.$eval('[data-booster] p', el => el.textContent).catch(() => l1);
  ok(l1 !== l2, `a szöveg váltakozik (${l1} → ${l2})`);
  await p.waitForSelector('[data-booster="tear"]', { timeout: 15000 }).catch(() => {});
  const tear = await p.evaluate(() => ({ phase: document.querySelector('[data-booster]')?.dataset.booster, html: document.documentElement.dataset.boosterNyit }));
  ok(tear.phase === 'tear' && tear.html === '1', `adat megjött: a booster teteje letépődik, a naptár kijön (${JSON.stringify(tear)})`);
  await wait(350);
  await p.screenshot({ path: `${SHOTS}naptar-booster-tepes.jpg`, quality: 60 });
  await wait(300);
  await p.screenshot({ path: `${SHOTS}naptar-booster-tepes2.jpg`, quality: 60 });
  await wait(1300);
  ok(!(await p.$('[data-booster]')) && !(await p.evaluate(() => document.documentElement.dataset.boosterNyit)), 'utána eltűnik');
  ok(await p.evaluate(() => /Pokémon klubnap/.test(document.body.innerText)), 'a naptár látszik az eseménnyel');
  await p.screenshot({ path: `${SHOTS}naptar-booster-utana.jpg`, quality: 60 });

  // kockás változat: lassú betöltésnél eldobott kocka, a 20-as dobásnál „Natural 20!”; adat érkezésekor eltűnik
  const k = await page(b, null, 402, 874);
  await k.evaluateOnNewDocument(() => { try { localStorage.setItem('tavern_selected_store', 'debrecen'); } catch { /* */ } window.__TAVERN_BETOLTO__ = 'kocka'; window.__D20_FORCE__ = 20; });
  await k.evaluateOnNewDocument(() => {
    // mikor kezdett eltűnni, és mikor látszott utoljára a „Natural 20!”
    new MutationObserver(() => {
      if (document.querySelector('[data-booster="tear"]') && !window.__tear) window.__tear = performance.now();
    }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-booster'] });
    // a „Natural 20!” felirat megjelenései (dobásonként egyszer: hiányzó → meglévő)
    window.__natural = []; let had = false;
    new MutationObserver(() => { const has = !!document.querySelector('[data-natural20]'); if (has && !had) window.__natural.push(performance.now()); had = has; }).observe(document, { childList: true, subtree: true, attributes: true });
  });
  await k.setRequestInterception(true);
  k.on('request', (req) => { if (req.url().includes('/api/public-data')) setTimeout(() => req.continue().catch(() => {}), 6000); else req.continue().catch(() => {}); });
  await k.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await k.waitForSelector('[data-betolto="kocka"] [data-kocka]', { timeout: 15000 }).catch(() => {});
  ok(!!(await k.$('[data-betolto="kocka"] [data-kocka]')) && /Keverjük|asztal|lapokat|program|kezdünk/.test(await k.$eval('[data-booster]', el => el.innerText).catch(() => '')), 'a booster helyett eldobott kocka is jöhet, ugyanazzal a szöveggel');
  await k.waitForSelector('[data-natural20]', { timeout: 8000 }).catch(() => {});
  ok(/Natural 20/.test(await k.$eval('[data-natural20]', el => el.textContent).catch(() => '')), '20-as dobásnál „Natural 20! Kritikus siker!”');
  await k.screenshot({ path: `${SHOTS}naptar-kocka.jpg`, quality: 60 });
  await k.waitForFunction(() => !document.querySelector('[data-booster]'), { timeout: 15000 }).catch(() => {});
  const kt = await k.evaluate(() => ({ tear: window.__tear, crit: window.__natural.filter(t => t < window.__tear).at(-1) }));
  ok(kt.tear && kt.crit && kt.tear - kt.crit >= 1500, `a kocka a megkezdett dobást (és a 20-as ünneplést) befejezi, csak utána tűnik el (az ünneplés ${Math.round(kt.tear - kt.crit)} ms-ig látszott)`);
  ok(!(await k.$('[data-booster]')) && await k.evaluate(() => /Pokémon klubnap/.test(document.body.innerText)), 'adat érkezésekor a kocka eltűnik, előjön a naptár');
  await k.close();

  // közepesen lassú betöltés (1 mp): még nincs booster
  const m = await page(b, null, 402, 874);
  await m.evaluateOnNewDocument(() => { try { localStorage.setItem('tavern_selected_store', 'debrecen'); } catch { /* */ } });
  await m.setRequestInterception(true);
  m.on('request', (req) => { if (req.url().includes('/api/public-data')) setTimeout(() => req.continue().catch(() => {}), 1000); else req.continue().catch(() => {}); });
  let mid = false;
  await m.exposeFunction('__booster', () => { mid = true; });
  await m.evaluateOnNewDocument(() => { new MutationObserver(() => { if (document.querySelector('[data-booster]')) window.__booster?.(); }).observe(document, { childList: true, subtree: true }); });
  await m.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
  await wait(800);
  ok(!mid, 'egy átlagos (1 mp-es) betöltésnél sem jelenik meg a booster');
  await m.close();

  // gyors betöltésnél nincs booster
  const f = await page(b, null, 402, 874);
  await f.evaluateOnNewDocument(() => { try { localStorage.setItem('tavern_selected_store', 'debrecen'); } catch { /* */ } });
  let seen = false;
  await f.exposeFunction('__booster', () => { seen = true; });
  await f.evaluateOnNewDocument(() => { new MutationObserver(() => { if (document.querySelector('[data-booster]')) window.__booster?.(); }).observe(document, { childList: true, subtree: true }); });
  await f.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
  await wait(500);
  ok(!seen, 'gyors betöltésnél nem villan fel a booster');
  console.log('  böngészőhibák:', [...p.errs, ...f.errs].join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
