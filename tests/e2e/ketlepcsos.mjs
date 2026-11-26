// Kétlépcsős belépés (lib/totp.js, lib/secondFactor.js, /api/auth/2fa, components/TwoFactorModal.jsx):
// bekapcsolás QR-kóddal / kulccsal, utána a belépéshez kód kell; a kód és a tartalék kód csak egyszer jó; kikapcsolás
// jelszóval + kóddal; a tulajdonos kikapcsolhatja (elveszett telefon); a titok nem kerül a mentésbe; böngészőben is.
import bcrypt from 'bcryptjs';
import { openDb, token, browser, page, ok, summary, wait, BASE, clickText } from './lib.mjs';
import { totpCode } from '../../lib/totp.js';

const { client, db } = await openDb();
const hash = await bcrypt.hash('kek-alma-zongora', 10);
const ownerId = (await db.collection('users').insertOne({ username: 'Tulaj', email: 'o@x.hu', password: hash, role: 'owner', lastSeenChangelog: '9999' })).insertedId;
await db.collection('users').insertOne({ username: 'Szervezo', email: 's@x.hu', password: hash, role: 'admin', allowedCategories: ['Pokémon TCG'], allowedStores: ['debrecen'], lastSeenChangelog: '9999' });
await db.collection('users').insertOne({ username: 'Bongeszo', email: 'b@x.hu', password: hash, role: 'admin', allowedCategories: ['Pokémon TCG'], allowedStores: ['debrecen'], lastSeenChangelog: '9999' });
const ownerTok = await token(ownerId, 'Tulaj', 'owner');

let ipN = 0;
const post = (url, body, cookie) => fetch(`${BASE}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.9.0.${++ipN}`, ...(cookie && { Cookie: `tavern_session=${cookie}` }) }, body: JSON.stringify(body) });
const cookieFrom = (res) => (res.headers.get('set-cookie') || '').match(/tavern_session=([^;]+)/)?.[1] || null;
const whoAmI = async (cookie) => (await (await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: `tavern_session=${cookie}` } })).json()).user?.username || null;
const login = (loginId, code) => post('/api/auth', { action: 'login', loginId, password: 'kek-alma-zongora', ...(code !== undefined && { code }) });
const status = async (cookie) => (await fetch(`${BASE}/api/auth/2fa`, { headers: { Cookie: `tavern_session=${cookie}` } })).json();
// a következő 30 mp-es lépés kódja (a mostanit a bekapcsolás már felhasználta)
const nextCode = (secret, plus = 30) => totpCode(secret, Date.now() + plus * 1000);

try {
  // --- Bekapcsolás (API) ---
  let org = cookieFrom(await login('Szervezo'));
  ok(!!org, 'belépés jelszóval (még nincs kétlépcsős)');
  let st = await status(org);
  ok(st.enabled === false && st.recommended === false, 'állapot: kikapcsolva, szervezőnek nem kiemelt');
  ok((await status(ownerTok)).recommended === true, 'a tulajdonosnak erősen ajánlott');
  const start = await (await post('/api/auth/2fa', { action: 'start' }, org)).json();
  ok(start.qr?.startsWith('data:image/svg+xml;base64,') && /^[A-Z2-7 ]{39}$/.test(start.secret) && start.uri.startsWith('otpauth://totp/Tavern%20Admin%3ASzervezo?'), 'QR-kód és kézi kulcs');
  const secret = start.secret.replace(/ /g, '');
  const wrong = await post('/api/auth/2fa', { action: 'confirm', code: '000000' === totpCode(secret) ? '111111' : '000000' }, org);
  ok(wrong.status === 400, 'hibás kóddal nem kapcsol be');
  const confirm = await post('/api/auth/2fa', { action: 'confirm', code: totpCode(secret) }, org);
  const { recoveryCodes } = await confirm.json();
  const orgNew = cookieFrom(confirm);
  ok(confirm.status === 200 && recoveryCodes?.length === 10, '10 tartalék kód');
  ok(await whoAmI(orgNew) === 'Szervezo' && await whoAmI(org) === null, 'ezen az eszközön bent marad, a régi süti érvénytelen');
  org = orgNew;
  ok((await status(org)).enabled === true, 'állapot: bekapcsolva');

  // --- Belépés kóddal ---
  const noCode = await login('Szervezo');
  ok(noCode.status === 401 && (await noCode.json()).needCode === true && !cookieFrom(noCode), 'jelszó után kódot kér (süti nélkül)');
  const badCode = await login('Szervezo', '123456' === nextCode(secret) ? '654321' : '123456');
  ok(badCode.status === 401 && !cookieFrom(badCode), 'hibás kóddal nem lép be');
  const code1 = nextCode(secret);
  const good = await login('Szervezo', code1);
  ok(good.status === 200 && await whoAmI(cookieFrom(good)) === 'Szervezo', 'jó kóddal belép');
  const replay = await login('Szervezo', code1);
  ok(replay.status === 401, 'ugyanaz a kód másodszor nem jó');
  const rc = await login('Szervezo', recoveryCodes[0].toUpperCase());
  const rcBody = await rc.json();
  ok(rc.status === 200 && rcBody.recoveryLeft === 9, `tartalék kóddal belép, 9 maradt (${rcBody.recoveryLeft})`);
  ok((await login('Szervezo', recoveryCodes[0])).status === 401, 'a tartalék kód másodszor nem jó');
  ok(!!(await db.collection('audit_logs').findOne({ action: 'KÉTLÉPCSŐS', details: /Tartalék kóddal/ })), 'a tartalék kódos belépés naplózva');

  // --- A titok nem szivárog ---
  const dump = await (await fetch(`${BASE}/api/export-db`, { headers: { Cookie: `tavern_session=${ownerTok}` } })).text();
  ok(!dump.includes(secret) && !dump.includes('recoveryCodes'), 'a mentésben nincs benne a titok és a tartalék kódok');
  const list = await (await fetch(`${BASE}/api/admin-users`, { headers: { Cookie: `tavern_session=${ownerTok}` } })).json();
  const orgRow = list.users.find(u => u.username === 'Szervezo');
  ok(orgRow.twoFactor === true && !JSON.stringify(list).includes(secret), 'a felhasználólistában csak az látszik, hogy be van kapcsolva');

  // --- Kikapcsolás: jelszó + kód ---
  const disNoPw = await post('/api/auth/2fa', { action: 'disable', password: 'rossz', code: nextCode(secret, 60) }, org);
  ok(disNoPw.status === 400, 'rossz jelszóval nem kapcsol ki');
  const dis = await post('/api/auth/2fa', { action: 'disable', password: 'kek-alma-zongora', code: recoveryCodes[1] }, org);
  ok(dis.status === 200 && (await status(cookieFrom(dis))).enabled === false, 'jelszó + tartalék kód: kikapcsolva');
  ok((await login('Szervezo')).status === 200, 'utána a jelszó elég');

  // --- Tulajdonos: elveszett telefon ---
  await db.collection('users').updateOne({ username: 'Szervezo' }, { $set: { totp: { secret, enabledAt: new Date(), lastStep: 0 }, recoveryCodes: [] } });
  ok((await login('Szervezo')).status === 401, '(újra bekapcsolva)');
  const orgId = String((await db.collection('users').findOne({ username: 'Szervezo' }))._id);
  const reset = await fetch(`${BASE}/api/admin-users`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `tavern_session=${ownerTok}` }, body: JSON.stringify({ actionType: 'RESET_2FA', payload: { userId: orgId } }) });
  ok(reset.status === 200 && (await login('Szervezo')).status === 200, 'a tulajdonos kikapcsolja: a jelszóval belép');

  // --- Böngészőben: bekapcsolás, majd belépés kóddal ---
  await db.collection('rate_limits').deleteMany({});
  const b = await browser();
  try {
    const brTok = cookieFrom(await login('Bongeszo'));
    const p = await page(b, brTok, 402, 874);
    await p.goto(`${BASE}/admin?lap=tovabbiak`, { waitUntil: 'networkidle2', timeout: 240000 });
    await p.waitForFunction(() => document.body.innerText.includes('Kétlépcsős belépés'), { timeout: 60000 });
    await clickText(p, 'button', 'Kétlépcsős belépés');
    await p.waitForSelector('[data-ketlepcsos-inditas]', { visible: true, timeout: 15000 });
    await p.click('[data-ketlepcsos-inditas]');
    await p.waitForSelector('[data-qr]', { visible: true, timeout: 15000 });
    ok(await p.$eval('[data-qr]', img => img.complete && img.naturalWidth > 0), 'a QR-kód megjelenik (a CSP engedi)');
    const key = (await p.$eval('[data-kulcs]', el => el.textContent)).replace(/ /g, '');
    await p.type('[data-kod] input, input[data-kod]', totpCode(key));
    await p.click('[data-bekapcsolas]');
    await p.waitForSelector('[data-tartalek-kodok]', { visible: true, timeout: 15000 });
    const shown = await p.$eval('[data-tartalek-kodok]', el => el.innerText);
    ok((shown.match(/[a-z2-9]{4}-[a-z2-9]{4}/g) || []).length === 10, 'a tartalék kódok megjelennek');
    await p.click('[data-kesz]');
    await wait(500);
    // kijelentkezés után a belépő oldal kódot kér
    await p.deleteCookie({ name: 'tavern_session', domain: 'localhost' });
    const q = await page(b, null, 402, 874);
    await q.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
    await q.waitForSelector('input[type=password]', { timeout: 60000 });
    await q.type('input[placeholder^="Felhasználónév"]', 'Bongeszo');
    await q.type('input[type=password]', 'kek-alma-zongora');
    await q.keyboard.press('Enter');
    await q.waitForSelector('[data-kod-lepes]', { visible: true, timeout: 20000 });
    ok(true, 'a jelszó után a kód lépés jelenik meg');
    await q.type('[data-kod-lepes] input', nextCode(key));
    await q.keyboard.press('Enter');
    await q.waitForFunction(() => /Események|Továbbiak/.test(document.body.innerText) && !document.querySelector('[data-kod-lepes]'), { timeout: 60000 });
    ok(true, 'kóddal belépve betölt az admin');
    ok(p.errs.length === 0 && q.errs.length === 0, `nincs hiba az oldalon (${[...p.errs, ...q.errs].join(' | ')})`);
  } finally {
    await b.close();
  }
} finally {
  await client.close();
  summary();
}
