// Előrendelés „Megveszem most” (Stripe fizetési link): a termékhez utólag is megadható / átírható / kivehető a link;
// a gombra kattintva a jelentkezés fizetés nélkül is bekerül a listába (checkoutAt), utána a Stripe oldala nyílik meg
// (előre kitöltött e-mail, client_reference_id = a jelentkezés azonosítója). A link csak a jelentkezés után megy ki.
import { openDb, token, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';

const { client, db } = await openDb();
const owner = (await db.collection('users').insertOne({ username: 'StripeTulaj', email: 'st@x.hu', password: 'x', role: 'owner', lastSeenChangelog: '9999' })).insertedId;
const tok = await token(owner, 'StripeTulaj', 'owner');
const api = async (path, body) => {
  const r = await fetch(`${BASE}${path}`, { method: body ? 'POST' : 'GET', headers: { Cookie: `tavern_session=${tok}`, ...(body && { 'Content-Type': 'application/json' }) }, body: body && JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};
const pub = (body) => fetch(`${BASE}/api/preorders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async r => ({ status: r.status, data: await r.json().catch(() => ({})) }));

const [A, B] = Object.values((await db.collection('preorder_products').insertMany([
  { name: 'Stripe Booster Box', category: 'Pokémon TCG', price: 52990, perPersonLimit: 0, isOpen: true, createdAt: new Date() },
  { name: 'Sima Display', category: 'Pokémon TCG', price: 9990, perPersonLimit: 0, isOpen: true, createdAt: new Date(Date.now() - 1000) },
])).insertedIds).map(String);
const LINK = 'https://buy.stripe.com/test_e2e123';
const base = { name: 'Stripe Booster Box', category: 'Pokémon TCG', perPersonLimit: 0, price: 52990 };

const b = await browser();
try {
  // --- Admin: utólag hozzáadható, rossz linkkel hiba ---
  ok((await api('/api/admin-preorders', { actionType: 'SAVE_PRODUCT', payload: { ...base, id: A, stripeUrl: 'https://gonosz.hu/fizetes' } })).status === 400, 'idegen (nem Stripe) link nem menthető');
  ok((await api('/api/admin-preorders', { actionType: 'SAVE_PRODUCT', payload: { ...base, id: A, stripeUrl: LINK } })).status === 200, 'a link utólag, szerkesztéssel hozzáadható');
  ok((await db.collection('preorder_products').findOne({ name: base.name })).stripeUrl === LINK, 'a link elmentve');
  ok((await api('/api/admin-preorders')).data.products.find(p => p.id === A)?.stripeUrl === LINK, 'az admin adatban látszik');
  ok((await db.collection('audit_logs').findOne({ action: 'ELŐRENDELÉS TERMÉK SZERKESZTÉSE', details: /Stripe link hozzáadva/ })) !== null, 'naplózva: Stripe link hozzáadva');

  // --- API ---
  const person = { name: 'Vásárló Vera', email: 'vera@pelda.hu', phone: '+36 30 111 2222' };
  ok((await pub({ ...person, items: [{ productId: B, quantity: 1 }], buyNow: true })).status === 409, 'link nélküli terméknél nincs azonnali fizetés');
  ok((await pub({ ...person, items: [{ productId: A, quantity: 1 }, { productId: B, quantity: 1 }], buyNow: true })).status === 400, 'egyszerre csak egy termékre');

  // --- Nyilvános oldal: a link nincs a lapban, csak a gomb ---
  const p = await page(b, null, 402, 874);
  await p.goto(`${BASE}/elorendeles?termek=${A}`, { waitUntil: 'networkidle2', timeout: 240000 });
  ok(!(await p.content()).includes('buy.stripe.com'), 'a Stripe link nincs benne az oldalban (csak jelentkezés után kapja meg)');
  ok(!!(await p.$('[data-megveszem]')) && /később fizetek/.test(await p.evaluate(() => document.body.innerText)), 'van „Megveszem most” és „Csak előrendelem” gomb');
  // hiányos adatokkal nem megy tovább
  await p.click('[data-megveszem]');
  await wait(400);
  ok(p.url().startsWith(BASE) && (await db.collection('preorders').countDocuments({ productId: A })) === 0, 'kitöltetlen űrlappal nem küld és nem irányít át');
  await p.screenshot({ path: `${SHOTS}elorendeles-stripe.jpg`, quality: 60, fullPage: true });

  // a Stripe oldalt nem töltjük be: az odairányítást elkapjuk
  let stripeUrl = '';
  await p.setRequestInterception(true);
  p.on('request', (r) => { if (r.url().startsWith('https://buy.stripe.com/')) { if (r.isNavigationRequest()) stripeUrl = r.url(); r.respond({ status: 200, contentType: 'text/html', body: '<p>stripe</p>' }); } else r.continue(); });
  await p.type('input[autocomplete="name"]', person.name);
  await p.type('input[autocomplete="email"]', person.email);
  await p.type('input[autocomplete="tel"]', person.phone);
  await p.click('[data-megveszem]');
  for (let i = 0; i < 100 && !stripeUrl; i++) await wait(200);
  const row = await db.collection('preorders').findOne({ productId: A, email: person.email });
  ok(!!row && row.checkoutAt instanceof Date && !row.paidAt, 'a jelentkezés bekerült a listába fizetés nélkül, „Stripe-ra ment” jelöléssel');
  const su = stripeUrl ? new URL(stripeUrl) : null;
  ok(su && su.origin + su.pathname === LINK, `átirányít a Stripe linkre (${stripeUrl})`);
  ok(su?.searchParams.get('prefilled_email') === person.email && su?.searchParams.get('client_reference_id') === String(row?._id), 'az e-mail előre kitöltve, a jelentkezés azonosítója átadva');

  // --- Több termék: nincs gomb, csak tipp ---
  const m = await page(b, null);
  await m.goto(`${BASE}/elorendeles`, { waitUntil: 'networkidle2' });
  await m.click(`[data-termek="${B}"]`);
  await wait(200);
  ok(!(await m.$('[data-megveszem]')), 'link nélküli terméknél nincs „Megveszem most”');
  await m.click(`[data-termek="${A}"]`);
  await wait(200);
  ok(!(await m.$('[data-megveszem]')) && /egyszerre egy termékre/.test(await m.evaluate(() => document.body.innerText)), 'két terméknél nincs gomb, a tipp elmondja, miért');

  // --- Beépítve (weboldal ablaka): új lapon nyílik, a sikerképernyőn ott a fizetési link ---
  const e = await page(b, null, 402, 874);
  await e.goto(`${BASE}/elorendeles?termek=${A}&embed=1`, { waitUntil: 'networkidle2' });
  const opened = new Promise(res => b.once('targetcreated', t => res(t)));
  await e.type('input[autocomplete="name"]', 'Beépített Béla');
  await e.type('input[autocomplete="email"]', 'bela@pelda.hu');
  await e.type('input[autocomplete="tel"]', '+36 30 333 4444');
  await e.click('[data-megveszem]');
  const tab = await Promise.race([opened, wait(8000).then(() => null)]);
  await e.waitForSelector('[data-fizetes] a', { timeout: 20000 }).catch(() => {});
  const payHref = await e.$eval('[data-fizetes] a', a => ({ href: a.href, target: a.target })).catch(() => null);
  ok(!!tab, 'beépítve a fizetés új lapon nyílik');
  ok(payHref?.href.startsWith(LINK) && payHref.target === '_blank' && /feliratkoztál/.test(await e.evaluate(() => document.body.innerText)), 'a sikerképernyőn „Tovább a fizetéshez” link (új lapra)');
  if (tab) await (await tab.page())?.close().catch(() => {});
  ok((await db.collection('preorders').findOne({ email: 'bela@pelda.hu' }))?.checkoutAt instanceof Date, 'beépítve is bekerült a listába');
  await e.screenshot({ path: `${SHOTS}elorendeles-stripe-siker.jpg`, quality: 60 });

  // --- Admin felület: címke a terméken és a soron, a mező a szerkesztőben ---
  const ad = await page(b, tok);
  await ad.goto(`${BASE}/admin/elorendeles`, { waitUntil: 'networkidle2' });
  await ad.waitForSelector('[data-stripe-cimke]', { timeout: 30000 }).catch(() => {});
  ok(!!(await ad.$('[data-stripe-cimke]')), 'admin: a terméken „Megveszem most gomb” címke');
  await ad.evaluate((name) => [...document.querySelectorAll('button')].find(x => x.textContent.trim() === name)?.click(), base.name);
  await wait(500);
  ok(!!(await ad.$('[data-stripe-kattintott]')), 'admin: a jelentkezőnél „Stripe-ra ment” címke');
  await ad.evaluate(() => [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Szerkesztés')?.click());
  await wait(600);
  ok(await ad.evaluate((l) => [...document.querySelectorAll('input')].some(i => i.value === l), LINK), 'admin: a szerkesztőben átírható a link');
  await ad.screenshot({ path: `${SHOTS}elorendeles-stripe-admin.jpg`, quality: 60 });

  // --- Átírás és kivétel ---
  ok((await api('/api/admin-preorders', { actionType: 'SAVE_PRODUCT', payload: { ...base, id: A, stripeUrl: 'https://buy.stripe.com/uj456' } })).status === 200
    && (await db.collection('preorder_products').findOne({ name: base.name })).stripeUrl === 'https://buy.stripe.com/uj456', 'a link átírható');
  ok((await api('/api/admin-preorders', { actionType: 'SAVE_PRODUCT', payload: { ...base, id: A, stripeUrl: '' } })).status === 200
    && (await db.collection('preorder_products').findOne({ name: base.name })).stripeUrl === null, 'üresre törölve kikerül');
  const after = await page(b, null);
  await after.goto(`${BASE}/elorendeles?termek=${A}`, { waitUntil: 'networkidle2' });
  ok(!(await after.$('[data-megveszem]')), 'link nélkül a gomb sem látszik');
  console.log('  böngészőhibák:', [...p.errs, ...e.errs, ...ad.errs].join(' | ') || 'nincs');
} finally {
  await b.close();
  await client.close();
}
summary();
