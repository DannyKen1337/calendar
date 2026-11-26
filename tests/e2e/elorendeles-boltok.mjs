// Előrendelés boltonként: a termékhez megadható, melyik boltban vehető át (üres: mindegyikben). A bolt linkje
// (?bolt=debrecen) csak az ott átvehető termékeket mutatja (a minden boltban átvehetőkkel együtt), az összesítő mindet,
// a termékeken az átvétel helyével. Ismeretlen bolt: az összesítő. Az admin a szerkesztőben választ boltot, és a
// boltok linkjeit egy gombbal másolhatja.
import { openDb, token, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';

const { client, db } = await openDb();
const owner = (await db.collection('users').insertOne({ username: 'BoltTulaj', email: 'bt@x.hu', password: 'x', role: 'owner', lastSeenChangelog: '9999' })).insertedId;
const tok = await token(owner, 'BoltTulaj', 'owner');
const api = async (body) => {
  const r = await fetch(`${BASE}/api/admin-preorders`, { method: body ? 'POST' : 'GET', headers: { Cookie: `tavern_session=${tok}`, ...(body && { 'Content-Type': 'application/json' }) }, body: body && JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};
const base = { category: 'Pokémon TCG', perPersonLimit: 0 };
const names = (pg) => pg.$$eval('[data-termek]', els => els.map(e => e.querySelector('b')?.textContent || ''));

const b = await browser();
try {
  ok((await api({ actionType: 'SAVE_PRODUCT', payload: { ...base, name: 'Rossz bolt', stores: ['budapest'] } })).status === 400, 'ismeretlen bolt nem menthető');
  const deb = (await api({ actionType: 'SAVE_PRODUCT', payload: { ...base, name: 'Debreceni doboz', stores: ['debrecen'] } })).data.id;
  await api({ actionType: 'SAVE_PRODUCT', payload: { ...base, name: 'Miskolci doboz', stores: ['miskolc'] } });
  await api({ actionType: 'SAVE_PRODUCT', payload: { ...base, name: 'Közös doboz', stores: [] } });
  await api({ actionType: 'SAVE_PRODUCT', payload: { ...base, name: 'Két bolt doboza', stores: ['miskolc', 'debrecen'] } });
  ok((await db.collection('preorder_products').findOne({ name: 'Két bolt doboza' })).stores.join(',') === 'debrecen,miskolc', 'a boltok a megszokott sorrendben mentve');

  // összesítő: minden bolt terméke, az átvétel helyével
  const p = await page(b, null, 402, 874);
  await p.goto(`${BASE}/elorendeles`, { waitUntil: 'networkidle2', timeout: 240000 });
  const all = await names(p);
  ok(['Debreceni doboz', 'Miskolci doboz', 'Közös doboz', 'Két bolt doboza'].every(n => all.includes(n)), `az összesítőn minden bolt terméke (${all.join(', ')})`);
  const atvetel = await p.$$eval('[data-termek]', els => Object.fromEntries(els.map(e => [e.querySelector('b')?.textContent, e.querySelector('[data-atvetel]')?.textContent || ''])));
  ok(atvetel['Debreceni doboz'] === 'Átvétel: Tavern Debrecen' && atvetel['Két bolt doboza'] === 'Átvétel: Tavern Debrecen, Tavern Miskolc' && /bármelyik/.test(atvetel['Közös doboz']), 'a termékeken az átvétel helye');

  // bolt linkje
  await p.goto(`${BASE}/elorendeles?bolt=debrecen`, { waitUntil: 'networkidle2' });
  const d = await names(p);
  ok(d.includes('Debreceni doboz') && d.includes('Közös doboz') && d.includes('Két bolt doboza') && !d.includes('Miskolci doboz'), `a debreceni linken csak az ott átvehetők (${d.join(', ')})`);
  ok(await p.$eval('[data-bolt-fejlec]', el => el.textContent) === 'Tavern Debrecen' && /Összes előrendelés/.test(await p.evaluate(() => document.body.innerText)), 'a fejlécben a bolt neve, és link az összesítőre');
  await p.screenshot({ path: `${SHOTS}elorendeles-bolt.jpg`, quality: 60, fullPage: true });
  await p.goto(`${BASE}/elorendeles?bolt=jatekceh&jatek=pokemon-tcg`, { waitUntil: 'networkidle2' });
  const j = await names(p);
  ok(j.length === 1 && j[0] === 'Közös doboz', `bolt és játék együtt (${j.join(', ')})`);
  await p.goto(`${BASE}/elorendeles?bolt=nincsilyen`, { waitUntil: 'networkidle2' });
  ok((await names(p)).length === 4, 'ismeretlen bolt: az összesítő');
  await db.collection('preorder_products').updateMany({ name: { $ne: 'Miskolci doboz' } }, { $set: { isOpen: false } });
  await p.goto(`${BASE}/elorendeles?bolt=debrecen`, { waitUntil: 'networkidle2' });
  ok((await names(p)).length === 0 && /Tavern Debrecen boltban jelenleg nincs nyitott előrendelés/.test(await p.evaluate(() => document.body.innerText)), 'ha a boltnak nincs nyitott előrendelése, azt írja (nem mutat más boltét)');
  await db.collection('preorder_products').updateMany({}, { $set: { isOpen: true } });

  // admin: bolt választó, címke, boltok linkjei
  const ad = await page(b, tok);
  await ad.goto(`${BASE}/admin/elorendeles`, { waitUntil: 'networkidle2' });
  await ad.waitForSelector('[data-bolt-linkek]', { timeout: 30000 }).catch(() => {});
  ok((await ad.$$('[data-bolt-link]')).length === 3, 'a boltok linkjei a lap tetején (3 bolt)');
  ok((await ad.$$('[data-termek-bolt="debrecen"]')).length >= 2, 'a termékeken a bolt címkéje');
  await ad.evaluate(() => { window.__copied = []; navigator.clipboard.writeText = async (t) => { window.__copied.push(t); }; });
  await ad.click('[data-bolt-link="miskolc"]');
  await wait(300);
  ok((await ad.evaluate(() => window.__copied[0] || '')).endsWith('/elorendeles?bolt=miskolc'), 'a gomb a bolt linkjét másolja');
  // a szerkesztőben a bolt átírható
  ok((await api({ actionType: 'SAVE_PRODUCT', payload: { ...base, id: deb, name: 'Debreceni doboz', stores: ['jatekceh'] } })).status === 200
    && (await api()).data.products.find(x => x.id === deb)?.stores.join() === 'jatekceh', 'a bolt utólag átírható');
  await ad.reload({ waitUntil: 'networkidle2' });
  await ad.waitForSelector('[data-bolt-linkek]', { timeout: 30000 }).catch(() => {});
  await ad.evaluate(() => [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Szerkesztés')?.click());
  await ad.waitForSelector('[data-bolt-valaszto]', { timeout: 10000 }).catch(() => {});
  ok(!!(await ad.$('[data-bolt-valaszto]')), 'a termék szerkesztőjében bolt választó');
  await ad.screenshot({ path: `${SHOTS}elorendeles-bolt-admin.jpg`, quality: 60 });
  console.log('  böngészőhibák:', [...p.errs, ...ad.errs].join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
