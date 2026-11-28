// A saját gépen futó tesztkörnyezet (asztali indító: TEST_ENV=1 és TEST_LOCAL=1): belépés nélkül nem az élő oldalra,
// hanem a teszt-belépőre visz (?vissza= a kért címmel), és belépés után oda tér vissza. Az API továbbra is 401.
// A vissza-cím csak saját útvonal lehet (más oldalra nem irányít).
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { openDb, browser, page, ok, summary, wait, BASE } from './lib.mjs';

const { client, db: live } = await openDb();
const test = client.db('TavernTeszt');
await test.dropDatabase();
const hash = await bcrypt.hash('Jelszo-12345', 10);
const user = { _id: new ObjectId(), username: 'TavernAdmin', email: 'bolt@pelda.hu', password: hash, role: 'owner', lastSeenChangelog: '9999' };
for (const d of [live, test]) await d.collection('users').insertOne({ ...user });

const raw = (path) => fetch(`${BASE}${path}`, { redirect: 'manual' });
const b = await browser();
try {
  for (const [from, to] of [['/', '/admin?vissza=%2F'], ['/hirek?bolt=debrecen', '/admin?vissza=%2Fhirek%3Fbolt%3Ddebrecen'], ['/admin/levelek', '/admin?vissza=%2Fadmin%2Flevelek']]) {
    const r = await raw(from);
    ok(r.status === 307 && r.headers.get('location') === to, `belépés nélkül ${from} → ${to} (${r.status} ${r.headers.get('location')})`);
  }
  const api = await raw('/api/admin-data');
  ok(api.status === 401, `az API belépés nélkül 401 (${api.status})`);

  // a weboldal ikonja: / → belépő → belépés után vissza a weboldalra
  const p = await page(b, null, 402, 874);
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 240000 });
  ok(new URL(p.url()).pathname === '/admin', `a weboldal belépés nélkül a belépőt nyitja (${p.url()})`);
  await p.waitForSelector('input[type="password"]', { timeout: 60000 });
  await p.type('input#loginId, input[id$="loginId"]', 'TavernAdmin');
  await p.type('input[type="password"]', 'Jelszo-12345');
  await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle2', timeout: 120000 }), p.keyboard.press('Enter')]);
  await wait(800);
  ok(new URL(p.url()).pathname === '/', `belépés után vissza a weboldalra (${p.url()})`);

  // idegen vissza-cím: nem visz el a saját oldalról
  const q = await page(await b.createBrowserContext(), null, 402, 874); // új, belépés nélküli böngészőprofil
  await q.goto(`${BASE}/admin?vissza=//pelda.hu/`, { waitUntil: 'networkidle2', timeout: 240000 });
  await q.waitForSelector('input[type="password"]', { timeout: 60000 });
  await q.type('input#loginId, input[id$="loginId"]', 'TavernAdmin');
  await q.type('input[type="password"]', 'Jelszo-12345');
  await Promise.all([q.waitForNavigation({ waitUntil: 'networkidle2', timeout: 120000 }), q.keyboard.press('Enter')]);
  await wait(800);
  ok(new URL(q.url()).host === new URL(BASE).host, `idegen vissza-címre nem irányít át (${q.url()})`);
  console.log('  böngészőhibák:', [...p.errs, ...q.errs].join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
