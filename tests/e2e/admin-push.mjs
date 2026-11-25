// Telefonos értesítés új válaszról (lib/push.js, components/PushToggle.jsx, public/admin-sw.js): a Továbbiak › Fiók részben
// a kapcsoló; iPhone-on a Safariban (webapp nélkül) a kapcsoló helyett a kezdőképernyős tipp; a service worker elérhető;
// az API csak bejelentkezve, csak ismert push-szolgáltató címét fogadja el, és más eszközét nem veheti ki; az időzítő
// címe titok nélkül zárva. Valódi feliratkozás nincs (az a böngésző push-szolgáltatóján menne át).
import { openDb, token, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';

const { client, db } = await openDb();
const ids = (await db.collection('users').insertMany([
  { username: 'Tulaj', email: 'o@x.hu', password: 'x', role: 'owner', lastSeenChangelog: '9999' },
  { username: 'Masik', email: 'm@x.hu', password: 'x', role: 'admin', features: ['personalBasic'], lastSeenChangelog: '9999' },
])).insertedIds;
const tok = { owner: await token(ids[0], 'Tulaj', 'owner') };
const api = (path, t, body) => fetch(`${BASE}${path}`, { method: body ? 'POST' : 'GET', headers: { ...(t && { Cookie: `tavern_session=${t}` }), ...(body && { 'Content-Type': 'application/json' }) }, body: body && JSON.stringify(body) });

const b = await browser();
try {
  // API
  ok((await api('/api/push')).status === 401, 'bejelentkezés nélkül 401');
  const k1 = await (await api('/api/push', tok.owner)).json();
  const k2 = await (await api('/api/push', tok.owner)).json();
  ok(/^[A-Za-z0-9_-]{80,}$/.test(k1.publicKey || '') && k1.publicKey === k2.publicKey, 'a nyilvános kulcs megvan és nem változik');
  const evil = await api('/api/push', tok.owner, { actionType: 'SUBSCRIBE', payload: { subscription: { endpoint: 'https://gonosz.example.com/x', keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) } } } });
  ok(evil.status === 400, 'idegen cím: elutasítva');
  const other = 'https://fcm.googleapis.com/fcm/send/masik-eszkoze';
  await db.collection('push_subscriptions').insertOne({ _id: other, userId: String(ids[1]), keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) } });
  await api('/api/push', tok.owner, { actionType: 'UNSUBSCRIBE', payload: { endpoint: other } });
  ok(!!(await db.collection('push_subscriptions').findOne({ _id: other })), 'más eszközét nem veheti ki');
  ok((await api('/api/cron/mailbox')).status === 401 && (await fetch(`${BASE}/api/cron/mailbox`, { headers: { Authorization: 'Bearer rossz' } })).status === 401, 'az időzítő címe titok nélkül zárva');
  const sw = await fetch(`${BASE}/admin-sw.js`);
  ok(sw.status === 200 && /javascript/.test(sw.headers.get('content-type') || '') && /showNotification/.test(await sw.text()), 'a service worker elérhető');

  // gépen (Chrome): kapcsoló
  const p = await page(b, tok.owner);
  await p.goto(`${BASE}/admin?lap=tovabbiak`, { waitUntil: 'networkidle2', timeout: 240000 });
  await p.waitForSelector('[data-push]', { timeout: 30000 });
  await p.waitForFunction(() => document.querySelector('[data-push]')?.dataset.push !== 'loading', { timeout: 10000 });
  ok(await p.$eval('[data-push]', el => el.dataset.push === 'off' && !!el.querySelector('[data-push-kapcsolo]') && /Értesítés új válaszról/.test(el.innerText)), 'gépen: „Értesítés új válaszról” kapcsoló, kikapcsolva');
  await p.$eval('[data-push]', el => el.scrollIntoView({ block: 'center' }));
  await p.screenshot({ path: `${SHOTS}push-kapcsolo-gep.jpg`, quality: 60 });

  // iPhone, Safariban (nem a kezdőképernyőről): tipp a kapcsoló helyett
  const ph = await page(b, tok.owner, 390, 844);
  await ph.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1');
  await ph.evaluateOnNewDocument(() => { delete window.PushManager; });
  await ph.goto(`${BASE}/admin?lap=tovabbiak`, { waitUntil: 'networkidle2' });
  await ph.waitForFunction(() => document.querySelector('[data-push]')?.dataset.push === 'ios', { timeout: 15000 }).catch(() => {});
  ok(await ph.$eval('[data-push]', el => el.dataset.push === 'ios' && !el.querySelector('[data-push-kapcsolo]') && /kezdőképernyőre/.test(el.innerText)), 'iPhone Safariban: a kezdőképernyős tipp, kapcsoló nélkül');
  ok((await ph.evaluate(() => document.documentElement.scrollWidth)) === 390, 'telefonon nincs vízszintes görgetés');
  await ph.$eval('[data-push]', el => el.scrollIntoView({ block: 'center' }));
  await wait(300);
  await ph.screenshot({ path: `${SHOTS}push-iphone-tipp.jpg`, quality: 60 });
  console.log('  böngészőhibák:', [...p.errs, ...ph.errs].join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
