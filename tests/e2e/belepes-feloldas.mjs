// Belépési zárolás feloldása: ha valaki túl sokszor rontja el a jelszavát (fiókonként 10 / 15 perc), vagy egy gépről
// túl sok kísérlet jön (IP-nként 20 / 15 perc), a tulajdonos a Felhasználók oldalon feloldhatja, és a felhasználó
// azonnal újra próbálkozhat. Más (pl. a felhasználókezelő szervező) nem oldhatja fel.
import bcrypt from 'bcryptjs';
import { openDb, token, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';

const { client, db } = await openDb();
const hash = await bcrypt.hash('Jelszo-12345', 10);
const ids = (await db.collection('users').insertMany([
  { username: 'FeloldoTulaj', email: 'ft@x.hu', password: hash, role: 'owner', lastSeenChangelog: '9999' },
  { username: 'Kezelo2', email: 'k2@x.hu', password: hash, role: 'admin', features: ['users'], lastSeenChangelog: '9999' },
  { username: 'Kizart', email: 'kizart@x.hu', password: hash, role: 'admin', lastSeenChangelog: '9999' },
])).insertedIds;
const ownerTok = await token(ids[0], 'FeloldoTulaj', 'owner');
const mgrTok = await token(ids[1], 'Kezelo2', 'admin');
const login = (loginId, password, ip) => fetch(`${BASE}/api/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: JSON.stringify({ action: 'login', loginId, password }) });
const api = async (t, body) => {
  const r = await fetch(`${BASE}/api/admin-users`, { method: body ? 'POST' : 'GET', headers: { Cookie: `tavern_session=${t}`, ...(body && { 'Content-Type': 'application/json' }) }, body: body && JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};

const b = await browser();
try {
  // zárolás: 10 hibás jelszó a fiókra (két gépről), és egy gép, ahonnan 20 kísérlet jött
  for (let i = 0; i < 5; i++) await login('Kizart', 'rossz-jelszo', '10.5.0.1');
  for (let i = 0; i < 5; i++) await login('Kizart', 'rossz-jelszo', '10.5.0.2');
  for (let i = 0; i < 3; i++) await login('kizart@x.hu', 'rossz-jelszo', '10.5.0.2'); // az e-mail címmel írt próbák is törlődnek a feloldáskor
  ok((await login('Kizart', 'Jelszo-12345', '10.5.0.3')).status === 429, 'a fiók 10 hibás jelszó után zárolva');
  for (let i = 0; i < 20; i++) await login(`nincs${i}`, 'x', '10.6.0.1');
  ok((await login('FeloldoTulaj', 'Jelszo-12345', '10.6.0.1')).status === 429, 'a gépről (IP) túl sok kísérlet: onnan most senki nem lép be');

  const g = await api(ownerTok);
  ok(g.data.users.find(u => u.username === 'Kizart')?.locked === true && g.data.users.find(u => u.username === 'Kezelo2')?.locked === false && g.data.lockedIps === 1, 'a tulajdonos látja, ki van kizárva, és hány gép');
  const m = await api(mgrTok);
  ok(m.data.users && m.data.users.every(u => u.locked === undefined) && m.data.lockedIps === undefined, 'a felhasználókezelő szervező nem látja a zárolásokat');
  ok((await api(mgrTok, { actionType: 'UNLOCK_LOGIN', payload: { userId: String(ids[2]) } })).status === 403, 'csak a tulajdonos oldhatja fel');

  // felület: figyelmeztetés, „Kizárva” címke és „Kizárás feloldása” gomb
  const p = await page(b, ownerTok, 402, 874);
  await p.goto(`${BASE}/admin/felhasznalok`, { waitUntil: 'networkidle2', timeout: 240000 });
  await p.waitForSelector('[data-kizarasok]', { timeout: 30000 }).catch(() => {});
  const alert = await p.$eval('[data-kizarasok]', el => el.textContent).catch(() => '');
  ok(/1 fiók kizárva/.test(alert) && /1 gépről/.test(alert), `a lap tetején figyelmeztetés (${alert.slice(0, 90)})`);
  ok((await p.$$('[data-kizarva]')).length === 1 && (await p.$$('[data-feloldas]')).length === 1, 'a kizárt fióknál „Kizárva” címke és feloldás gomb');
  await p.screenshot({ path: `${SHOTS}belepes-feloldas.jpg`, quality: 60, fullPage: true });
  await p.click('[data-feloldas]');
  await p.waitForFunction(() => !document.querySelector('[data-kizarva]'), { timeout: 15000 }).catch(() => {});
  ok(!(await p.$('[data-kizarva]')), 'feloldás után eltűnik a címke');
  ok((await login('Kizart', 'Jelszo-12345', '10.5.0.3')).status === 200, 'a felhasználó azonnal újra be tud lépni');
  ok(!!(await db.collection('audit_logs').findOne({ action: 'BELÉPÉS FELOLDÁS', details: /Kizart/ })), 'naplózva');
  // a fiók feloldása annak a gépnek a zárolását is megszünteti, ahonnan a hibás jelszavak jöttek
  for (let i = 0; i < 10; i++) await login('Kizart', 'rossz', '10.7.0.1');
  for (let i = 0; i < 9; i++) await login(`masik${i}`, 'x', '10.7.0.1');
  ok((await login('Kizart', 'Jelszo-12345', '10.7.0.1')).status === 429, 'újra zárolva (fiók és gép)');
  await api(ownerTok, { actionType: 'UNLOCK_LOGIN', payload: { userId: String(ids[2]) } });
  ok((await login('Kizart', 'Jelszo-12345', '10.7.0.1')).status === 200, 'a fiók feloldása ugyanarról a gépről is beengedi');

  // összes feloldása: a gép is
  await p.reload({ waitUntil: 'networkidle2' });
  await p.waitForSelector('[data-feloldas-mind]', { timeout: 20000 }).catch(() => {});
  await p.click('[data-feloldas-mind]');
  await wait(400);
  await p.evaluate(() => [...document.querySelectorAll('.ant-popconfirm button')].find(x => x.textContent.trim() === 'Feloldás')?.click());
  await p.waitForFunction(() => !document.querySelector('[data-kizarasok]'), { timeout: 15000 }).catch(() => {});
  ok(!(await p.$('[data-kizarasok]')), '„Összes feloldása” után nincs figyelmeztetés');
  ok((await login('FeloldoTulaj', 'Jelszo-12345', '10.6.0.1')).status === 200, 'a zárolt gépről is újra lehet belépni');
  console.log('  böngészőhibák:', p.errs.join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
