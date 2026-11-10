// Eseményoldal és naptár: Google-jelölés (schema.org Event), naptárba mentés egy eseményre, emoji nélküli különleges
// események, a beágyazott naptár heti nézete, és a gyors első betöltés (az adat nem vár a munkamenet-ellenőrzésre).
import { openDb, get, browser, page, ok, summary, wait, BASE } from './lib.mjs';

const { client, db } = await openDb();
const pad = (n) => String(n).padStart(2, '0');
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const ids = (await db.collection('tournaments').insertMany([
  { name: 'One Piece Store Tournament', date: `${day(1)}T17:30`, category: 'One Piece Card Game', store: 'jatekceh', max_players: 20, current_players: 0, is_open: true, description: 'Hozd a paklidat!', createdAt: new Date() },
  { name: 'Szett megjelenés este', date: `${day(1)}T19:00`, category: 'Pokémon TCG', store: 'jatekceh', eventType: 'release', max_players: 30, current_players: 0, is_open: true, createdAt: new Date() },
])).insertedIds;
const opId = String(ids[0]);
const EMOJI = /\p{Extended_Pictographic}/u;

const b = await browser();
try {
  // Google-jelölés
  const html = await (await get(`/esemeny/${opId}`)).text();
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  let ld = null;
  try { ld = m && JSON.parse(m[1]); } catch { /* hibás JSON */ }
  ok(ld?.['@type'] === 'Event' && ld.name === 'One Piece Store Tournament', 'Google: schema.org Event a névvel');
  ok(/^\d{4}-\d{2}-\d{2}T17:30:00\+0[12]:00$/.test(ld?.startDate || ''), `Google: kezdés magyar időzónával (${ld?.startDate})`);
  ok(ld?.location?.address?.streetAddress === 'Batthyány u. 1' && ld?.location?.name === 'JátékCéh', 'Google: a bolt címe');
  ok(ld?.eventAttendanceMode === 'https://schema.org/OfflineEventAttendanceMode' && ld?.eventStatus === 'https://schema.org/EventScheduled', 'Google: helyszíni, megtartott esemény');

  // Naptárba mentés egy eseményre
  const ics = await get(`/api/export?event=${opId}`);
  const icsText = await ics.text();
  ok(/text\/calendar/.test(ics.headers.get('content-type') || '') && (icsText.match(/BEGIN:VEVENT/g) || []).length === 1 && icsText.includes('One Piece Store Tournament'), 'naptárba mentés: egyetlen esemény ICS-ben');
  ok(/LOCATION:JátékCéh\\, Batthyány u\. 1\\, 4024 Debrecen/.test(icsText.replace(/\r\n /g, '')), 'naptárba mentés: a JátékCéh pontos címe');
  const nf = await get('/api/export?event=nincsilyen');
  ok(nf.status === 404 && /application\/json/.test(nf.headers.get('content-type') || ''), 'naptárba mentés: ismeretlen eseményre 404, JSON-ként');
  let p = await page(b, null, 402, 874);
  await p.goto(`${BASE}/esemeny/${opId}`, { waitUntil: 'networkidle2', timeout: 240000 });
  const cal = await p.evaluate(() => { const a = [...document.querySelectorAll('a')].find(x => /Naptárba/.test(x.textContent)); return a ? { href: a.getAttribute('href'), h: a.getBoundingClientRect().height } : null; });
  ok(cal && cal.href === `/api/export?event=${opId}` && cal.h >= 44, 'eseményoldal: „Naptárba” gomb');

  // Különleges esemény: nincs emoji
  await p.goto(`${BASE}/esemeny/${String(ids[1])}`, { waitUntil: 'networkidle2' });
  ok(!EMOJI.test(await p.evaluate(() => document.body.innerText)) && /Szett megjelenés/.test(await p.evaluate(() => document.body.innerText)), 'különleges esemény: címke emoji nélkül');

  // Gyors első betöltés: a munkamenet-ellenőrzés 3 mp-ig késik, a naptár mégis megjelenik előtte
  p = await page(b, null, 402, 874);
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem('tavern_selected_store', 'jatekceh'); } catch { /* */ } });
  await p.setRequestInterception(true);
  p.on('request', r => { if (r.url().includes('/api/auth/session')) setTimeout(() => r.continue().catch(() => {}), 3000); else r.continue().catch(() => {}); });
  const t0 = Date.now();
  await p.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('[aria-label="Előző hónap"]', { timeout: 15000 }).catch(() => {});
  const shown = Date.now() - t0;
  ok(shown < 2900, `gyors betöltés: a naptár nem vár a munkamenetre (${shown} ms)`);
  const dsk = await page(b, null, 1440, 900);
  await dsk.evaluateOnNewDocument(() => { try { localStorage.setItem('tavern_selected_store', 'jatekceh'); } catch { /* */ } });
  await dsk.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
  await dsk.waitForSelector('[aria-label="Előző hónap"]', { timeout: 30000 });
  const strips = await dsk.evaluate(() => [...document.querySelectorAll('[data-day] button')].map(x => x.textContent).join(' | '));
  ok(!EMOJI.test(strips) && !/Megjelenés|Különleges/.test(strips), `naptár: a különleges esemény sávján nincs kiírva a típus (${strips.slice(0, 60)})`);
  const glow = await dsk.evaluate(() => { const x = [...document.querySelectorAll('[data-day] button')].find(b => b.textContent.includes('19:00')); const cs = x && getComputedStyle(x); return cs ? { anim: cs.animationName, border: cs.borderTopWidth } : null; });
  ok(glow && /specialGlow/.test(glow.anim) && glow.border === '2px', `naptár: a különleges esemény sávja világító kerettel (${JSON.stringify(glow)})`);
  // a nap listájában (telefon) is világító keret, felirat nélkül
  const ph = await page(b, null, 402, 874);
  await ph.evaluateOnNewDocument(() => { try { localStorage.setItem('tavern_selected_store', 'jatekceh'); } catch { /* */ } });
  await ph.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
  await ph.waitForSelector('[aria-label="Előző hónap"]', { timeout: 30000 });
  const tomorrow = await ph.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  await ph.click(`[data-day="${tomorrow}"]`).catch(() => {});
  await wait(400);
  const row = await ph.evaluate(() => { const li = [...document.querySelectorAll('[data-ujsor]')].find(l => l.textContent.includes('Szett megjelenés este')); const btn = li?.querySelector('button'); return btn ? { anim: getComputedStyle(btn).animationName, text: li.textContent } : null; });
  ok(row && /specialGlow/.test(row.anim) && !/Megjelenés ·|Különleges esemény ·/.test(row.text), `nap listája: világító keret, típusfelirat nélkül (${JSON.stringify(row)})`);
  const dot = await ph.evaluate((k) => { const c = document.querySelector(`[data-day="${k}"]`); const sp = c && [...c.querySelectorAll('span span')].find(x => getComputedStyle(x).animationName.includes('specialGlow')); return !!sp; }, tomorrow);
  ok(dot, 'telefonos rács: a különleges esemény pöttye világít');

  // Karbantartás: a belépett szervező nem látja egy pillanatra sem a karbantartás képernyőt
  await db.collection('settings').updateOne({ _id: 'global_settings' }, { $set: { isMaintenance: true } }, { upsert: true });
  const { token } = await import('./lib.mjs');
  const staff = (await db.collection('users').insertOne({ username: 'Szervezo', role: 'admin', features: [], allowedCategories: null, allowedStores: null, lastSeenChangelog: '9999' })).insertedId;
  const ctx = await b.createBrowserContext();
  const mp = await page(ctx, await token(staff, 'Szervezo', 'admin'), 402, 874);
  await mp.evaluateOnNewDocument(() => { window.__latottKarbantartas = false; new MutationObserver(() => { if (document.body?.innerText.includes('Karbantartás alatt')) window.__latottKarbantartas = true; }).observe(document, { subtree: true, childList: true, characterData: true }); });
  await mp.setRequestInterception(true);
  mp.on('request', r => { if (r.url().includes('/api/auth/session')) setTimeout(() => r.continue().catch(() => {}), 1500); else r.continue().catch(() => {}); });
  await mp.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
  await wait(800);
  ok(!(await mp.evaluate(() => window.__latottKarbantartas)), 'karbantartás: a szervező nem látja a karbantartás képernyőt');
  await ctx.close();
  await db.collection('settings').updateOne({ _id: 'global_settings' }, { $set: { isMaintenance: false } });

  // Beágyazott naptár: a heti nézet is az új
  p = await page(b, null, 402, 874);
  await p.goto(`${BASE}/embed?store=jatekceh`, { waitUntil: 'networkidle2' });
  await p.waitForSelector('[aria-label="Nézet"] button', { timeout: 30000 });
  await p.evaluate(() => [...document.querySelectorAll('[aria-label="Nézet"] button')].find(x => x.textContent.trim() === 'Heti').click());
  await wait(600);
  ok(!!(await p.$('[data-het]')), 'beágyazva: az új heti nézet');
  console.log('  böngészőhibák:', p.errs.join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
