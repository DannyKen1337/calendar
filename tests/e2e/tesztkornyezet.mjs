// Tesztkörnyezet (lib/testEnv.js; a szerver TEST_ENV=1, TEST_USERS, MONGODB_DB=TavernTeszt beállítással fut):
// belépés nélkül minden az élő oldalra irányít (a belépő oldal kivételével), csak a tesztfiókok léphetnek be, saját
// adatbázis (az élőhöz nem nyúl), friss másolat az éles adatokról, „Tesztkörnyezet” jelzés, a keresők nem indexelik.
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { openDb, token, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';

const { client, db: live } = await openDb(); // az „éles” adatbázis (Tavern)
const test = client.db('TavernTeszt');
await test.dropDatabase();
const hash = await bcrypt.hash('Jelszo-12345', 10);
const tulaj = { _id: new ObjectId(), username: 'TesztTulaj', email: 'tulaj@pelda.hu', password: hash, role: 'owner', lastSeenChangelog: '9999' };
const bolt = { _id: new ObjectId(), username: 'TavernAdmin', email: 'bolt@pelda.hu', password: hash, role: 'owner', lastSeenChangelog: '9999' };
const mas = { _id: new ObjectId(), username: 'MasSzervezo', email: 'mas@pelda.hu', password: hash, role: 'admin', lastSeenChangelog: '9999' };
// a fiókok mindkét adatbázisban (a másolat után is érvényes a belépés)
for (const d of [live, test]) await d.collection('users').insertMany([tulaj, bolt, mas].map(u => ({ ...u })));
const pad = (n) => String(n).padStart(2, '0');
const day = (o) => { const d = new Date(); d.setDate(d.getDate() + o); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
await live.collection('tournaments').insertOne({ name: 'Éles verseny', date: `${day(3)}T18:00`, category: 'Pokémon TCG', store: 'debrecen', max_players: 20, is_open: true });
await test.collection('tournaments').insertOne({ name: 'Teszt verseny', date: `${day(3)}T18:00`, category: 'Pokémon TCG', store: 'debrecen', max_players: 20, is_open: true });

const raw = (path, cookie, init = {}) => fetch(`${BASE}${path}`, { redirect: 'manual', ...init, headers: { ...(init.headers || {}), ...(cookie && { Cookie: `tavern_session=${cookie}` }) } });
const login = (loginId, extra = {}) => fetch(`${BASE}/api/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'login', loginId, password: 'Jelszo-12345', ...extra }) });

const b = await browser();
try {
  // --- belépés nélkül: az élő oldalra ---
  for (const [from, to] of [['/', 'https://www.tavern.hu/naptar'], ['/naptar', 'https://www.tavern.hu/naptar'], ['/esemeny/abc?x=1', 'https://www.tavern.hu/esemeny/abc?x=1'], ['/admin/levelek', 'https://www.tavern.hu/admin/levelek']]) {
    const r = await raw(from);
    ok(r.status === 307 && r.headers.get('location') === to, `belépés nélkül ${from} → ${to} (${r.status} ${r.headers.get('location')})`);
  }
  ok((await raw('/api/public-data')).status === 401, 'belépés nélkül az API sem válaszol (401)');
  const adminPage = await raw('/admin');
  ok(adminPage.status === 200, `a belépő oldal elérhető (${adminPage.status})`);

  // --- belépés: csak a tesztfiókok ---
  ok((await login('MasSzervezo')).status === 403, 'más fiókkal (helyes jelszóval) nem lehet belépni');
  ok((await login('TavernAdmin')).status === 200, 'a TavernAdmin beléphet');
  ok((await login('TesztTulaj')).status === 200, 'a tulajdonos beléphet');
  ok((await fetch(`${BASE}/api/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'register', username: 'uj', email: 'uj@pelda.hu', password: 'Hosszu-jelszo-1' }) })).status === 403, 'regisztrálni nem lehet');

  // --- belépve: minden látszik, jelzéssel, a keresők elől elrejtve ---
  const own = await token(tulaj._id, 'TesztTulaj', 'owner');
  const other = await token(mas._id, 'MasSzervezo', 'admin');
  ok((await raw('/', other)).status === 307, 'más fiók érvényes sütijével sem lát semmit');
  const home = await raw('/', own);
  const html = await home.text();
  ok(home.status === 200 && /data-tesztkornyezet/.test(html) && /noindex/.test(home.headers.get('x-robots-tag') || ''), `belépve a weboldal látszik, „Tesztkörnyezet” jelzéssel, noindex (${home.status})`);

  // --- saját adatbázis ---
  const cal = await (await raw('/api/public-data', own)).json();
  ok(cal.tournaments?.some(t => t.name === 'Teszt verseny') && !cal.tournaments.some(t => t.name === 'Éles verseny'), 'a teszt a saját adatbázisát használja, nem az élőt');
  const p = await page(b, own, 402, 874);
  await p.goto(`${BASE}/naptar`, { waitUntil: 'networkidle2', timeout: 240000 });
  await wait(800);
  ok(await p.evaluate(() => !!document.querySelector('[data-tesztkornyezet]')), 'a naptárban is ott a jelzés');
  await p.screenshot({ path: `${SHOTS}tesztkornyezet.jpg`, quality: 60 });

  // --- friss másolat az éles adatokról ---
  ok((await raw('/api/test-env', other, { method: 'POST' })).status === 403 && (await raw('/api/test-env', null, { method: 'POST', headers: { Authorization: 'Bearer rossz' } })).status === 403, 'másolatot más (vagy rossz kulccsal) nem kérhet');
  const copy = await raw('/api/test-env', null, { method: 'POST', headers: { Authorization: 'Bearer e2e-teszt-kulcs' } });
  const cj = await copy.json();
  ok(copy.status === 200 && cj.counts?.tournaments === 1 && cj.counts?.users === 3, `a beállító kulccsal: friss másolat (${JSON.stringify(cj.counts)})`);
  const cal2 = await (await raw('/api/public-data?friss=1', own)).json();
  ok(cal2.tournaments?.some(t => t.name === 'Éles verseny') && !cal2.tournaments.some(t => t.name === 'Teszt verseny'), 'a másolat után az éles adatok látszanak a tesztben');
  ok(await live.collection('tournaments').countDocuments() === 1 && !!(await live.collection('tournaments').findOne({ name: 'Éles verseny' })), 'az éles adatbázis érintetlen');
  // a tulajdonos a Rendszer oldalról is kérheti
  const sp = await page(b, own, 1280, 900);
  await sp.goto(`${BASE}/admin/rendszer`, { waitUntil: 'networkidle2' });
  await sp.waitForSelector('[data-teszt-masolat]', { timeout: 30000 }).catch(() => {});
  ok(!!(await sp.$('[data-teszt-masolat]')), 'a Rendszer oldalon ott a „Friss másolat az éles adatokról” gomb');
  console.log('  böngészőhibák:', [...p.errs, ...sp.errs].join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
