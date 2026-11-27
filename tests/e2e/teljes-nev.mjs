// Teljes név a fiókoknál (nem kötelező): a tulajdonos mindenkinek beírhatja (a sajátját is) a Felhasználók oldalon;
// ha meg van adva, az admin felületen és a levelek aláírásában (feladónév is) ez látszik a felhasználónév helyett.
// Üresre törölve újra a felhasználónév látszik. Hamis SMTP-szerverrel (levelezős kör: SMTP_USER = bolt@teszt.hu).
import { openDb, token, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';
import { startSmtp } from './fake-smtp.mjs';

const { client, db } = await openDb();
const ids = (await db.collection('users').insertMany([
  { username: 'NevTulaj', email: 'nt@x.hu', password: 'x', role: 'owner', lastSeenChangelog: '9999' },
  { username: 'kata99', email: 'kata99@x.hu', password: 'x', role: 'admin', features: ['mailbox'], lastSeenChangelog: '9999' },
  { username: 'Kezelo3', email: 'k3@x.hu', password: 'x', role: 'admin', features: ['users'], lastSeenChangelog: '9999' },
])).insertedIds;
const ownerTok = await token(ids[0], 'NevTulaj', 'owner');
const kataTok = await token(ids[1], 'kata99', 'admin');
const mgrTok = await token(ids[2], 'Kezelo3', 'admin');
await db.collection('inbox_mails').insertOne({ _id: '<n1@teszt>', uid: 1, messageId: '<n1@teszt>', from: { name: 'Vevő Vilma', address: 'vilma@pelda.hu' }, to: [{ name: '', address: 'bolt@teszt.hu' }], subject: 'Kérdés', date: new Date(), text: 'Mikor nyittok?', attachments: [] });
const api = async (t, body) => {
  const r = await fetch(`${BASE}/api/admin-users`, { method: body ? 'POST' : 'GET', headers: { Cookie: `tavern_session=${t}`, ...(body && { 'Content-Type': 'application/json' }) }, body: body && JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};
const smtp = await startSmtp();
const b = await browser();
try {
  ok((await api(ownerTok, { actionType: 'SET_FULL_NAME', payload: { userId: String(ids[1]), fullName: 'x'.repeat(81) } })).status === 400, 'túl hosszú név nem menthető');
  ok((await api(mgrTok, { actionType: 'SET_FULL_NAME', payload: { userId: String(ids[0]), fullName: 'Más Név' } })).status === 403, 'a felhasználókezelő a tulajdonos nevét nem írhatja át');
  ok((await api(ownerTok, { actionType: 'SET_FULL_NAME', payload: { userId: String(ids[0]), fullName: '  Tulaj   Tamás ' } })).status === 200
    && (await db.collection('users').findOne({ _id: ids[0] })).fullName === 'Tulaj Tamás', 'a tulajdonos a saját nevét is beírhatja (szóközök rendbe téve)');

  // felület: a tulajdonos beírja Kata teljes nevét
  const p = await page(b, ownerTok);
  await p.goto(`${BASE}/admin/felhasznalok`, { waitUntil: 'networkidle2', timeout: 240000 });
  await p.waitForSelector('[data-nev-szerk]', { timeout: 30000 }).catch(() => {});
  await p.evaluate(() => [...document.querySelectorAll('[data-nev-szerk]')].find(x => /kata99/.test(x.getAttribute('aria-label')))?.click());
  await p.waitForSelector('[data-nev-mezo]', { timeout: 10000 });
  await p.type('[data-nev-mezo]', 'Kovács Kata');
  await p.click('[data-nev-mentes]');
  await p.waitForFunction(() => [...document.querySelectorAll('[data-teljes-nev]')].some(x => x.textContent === 'Kovács Kata'), { timeout: 15000 }).catch(() => {});
  ok((await db.collection('users').findOne({ _id: ids[1] })).fullName === 'Kovács Kata', 'a Felhasználók oldalon beírható');
  ok(/Felhasználónév: kata99/.test(await p.evaluate(() => document.body.innerText)), 'a kártyán a teljes név, alatta a felhasználónév');
  await p.screenshot({ path: `${SHOTS}teljes-nev.jpg`, quality: 60 });

  // Kata az adminban a teljes nevét látja, és azzal írja alá a válaszlevelet
  const k = await page(b, kataTok);
  await k.goto(`${BASE}/admin?lap=tovabbiak`, { waitUntil: 'networkidle2' });
  await k.waitForFunction(() => /Kovács Kata/.test(document.body.innerText), { timeout: 30000 }).catch(() => {});
  ok(/Fiók · Kovács Kata/.test(await k.evaluate(() => document.body.innerText)), 'az admin felületen a teljes név látszik');
  const r = await fetch(`${BASE}/api/inbox`, { method: 'POST', headers: { Cookie: `tavern_session=${kataTok}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'REPLY', id: '<n1@teszt>', text: 'Szombaton 10-kor.' }) });
  ok(r.status === 200, 'a válasz elment');
  let m = null;
  for (let i = 0; i < 50 && !m; i++) { m = (await smtp.mails()).find(x => x.to.includes('vilma@pelda.hu')); if (!m) await wait(200); }
  ok(/Szombaton 10-kor\.\n\nKovács Kata\nTavern/.test(m?.text || '') && m?.from?.name === 'Kovács Kata – Tavern', `aláírás és feladónév a teljes névvel (${m?.from?.name})`);
  ok((await db.collection('inbox_mails').findOne({ _id: '<n1@teszt>' })).replies[0].by === 'kata99', 'a nyilvántartásban a felhasználónév marad (ki küldte)');

  // üresre törölve újra a felhasználónév
  await api(ownerTok, { actionType: 'SET_FULL_NAME', payload: { userId: String(ids[1]), fullName: '' } });
  const s = await (await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: `tavern_session=${kataTok}` } })).json();
  ok(s.user?.displayName === 'kata99' && !(await db.collection('users').findOne({ _id: ids[1] })).fullName, 'üresre törölve a felhasználónév látszik');
  ok(!!(await db.collection('audit_logs').findOne({ action: 'FIÓK', details: /kata99 teljes neve: Kovács Kata/ })), 'naplózva');
  console.log('  böngészőhibák:', [...p.errs, ...k.errs].join(' | ') || 'nincs');
} finally {
  await b.close(); await smtp.close(); await client.close(); summary();
}
