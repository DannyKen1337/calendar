// Biztonsági javítások (élesítés előtt): idegen oldalról indított írási kérés tiltása (Origin), munkamenet-verzió
// (jelszócsere, új ideiglenes jelszó és „Kijelentkezés minden eszközről” után a régi süti érvénytelen), fiókonkénti
// korlát a hibás belépésekre, a képfeltöltés csak képet fogad, beágyazási szabályok, az esemény mezőinek típusa.
import bcrypt from 'bcryptjs';
import { openDb, token, browser, page, ok, summary, wait, BASE, clickText } from './lib.mjs';

const { client, db } = await openDb();
const hash = await bcrypt.hash('Jelszo-12345', 10);
const owner = (await db.collection('users').insertOne({ username: 'Tulaj', email: 'o@x.hu', password: hash, role: 'owner', lastSeenChangelog: '9999' })).insertedId;
await db.collection('users').insertOne({ username: 'Szervezo', email: 's@x.hu', password: hash, role: 'admin', allowedCategories: ['Pokémon TCG'], allowedStores: ['debrecen'], lastSeenChangelog: '9999' });
const victim = (await db.collection('users').insertOne({ username: 'Celpont', email: 'c@x.hu', password: hash, role: 'admin', lastSeenChangelog: '9999' })).insertedId;
const ownerTok = await token(owner, 'Tulaj', 'owner');

const post = (url, body, { cookie, origin, ip } = {}) => fetch(`${BASE}${url}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(cookie && { Cookie: `tavern_session=${cookie}` }), ...(origin && { Origin: origin }), ...(ip && { 'X-Forwarded-For': ip }) },
  body: JSON.stringify(body),
});
const whoAmI = async (cookie) => (await (await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: `tavern_session=${cookie}` } })).json()).user?.username || null;
const cookieFrom = (res) => (res.headers.get('set-cookie') || '').match(/tavern_session=([^;]+)/)?.[1] || null;
const login = async (loginId, password, ip = '10.0.0.1') => post('/api/auth', { action: 'login', loginId, password }, { ip });

try {
  // --- Origin (CSRF) ---
  const evil = await post('/api/actions', { actionType: 'ADD_TOURNAMENT', payload: { name: 'Gonosz', category: 'Pokémon TCG', store: 'debrecen', date: '2030-01-01T18:00' } }, { cookie: ownerTok, origin: 'https://gonosz.example' });
  ok(evil.status === 403, `idegen oldalról indított írás: 403 (${evil.status})`);
  ok(!(await db.collection('tournaments').findOne({ name: 'Gonosz' })), 'az idegen kérés nem hozott létre eseményt');
  const sub = await post('/api/auth', { action: 'login', loginId: 'Tulaj', password: 'Jelszo-12345' }, { origin: 'https://shop.tavern.hu' });
  ok(sub.status === 403, `aldomainről (pl. a webshopból) sem lehet írni: 403 (${sub.status})`);
  const own = await post('/api/actions', { actionType: 'ADD_TOURNAMENT', payload: { name: 'Saját', category: 'Pokémon TCG', store: 'debrecen', date: '2030-01-01T18:00' } }, { cookie: ownerTok, origin: BASE });
  ok(own.status === 200, `a saját oldalról jövő kérés átmegy (${own.status})`);
  const read = await fetch(`${BASE}/api/public-data`, { headers: { Origin: 'https://gonosz.example' } });
  ok(read.status === 200, 'olvasni idegen Originnel is lehet (GET)');

  // --- Az esemény mezőinek típusa ---
  const badType = await post('/api/actions', { actionType: 'ADD_TOURNAMENT', payload: { name: { $gt: '' }, category: 'Pokémon TCG', store: 'debrecen', date: '2030-01-01T18:00' } }, { cookie: ownerTok });
  ok(badType.status === 400, `objektum a név helyén: elutasítva (${badType.status})`);
  const badColor = await post('/api/actions', { actionType: 'ADD_TOURNAMENT', payload: { name: 'Szín', category: 'Egyéb', store: 'debrecen', date: '2030-01-01T18:00', color: 'red;background:url(x)', max_players: '12', isFeatured: 'igen' } }, { cookie: ownerTok });
  const colored = await db.collection('tournaments').findOne({ name: 'Szín' });
  ok(badColor.status === 200 && colored && colored.color === undefined && colored.max_players === 12 && colored.isFeatured === false, 'a hibás szín kimarad, a létszám szám, a pipa igaz/hamis');

  // --- Munkamenet-verzió: régi (verzió nélküli) süti továbbra is jó ---
  const victimOld = await token(victim, 'Celpont', 'admin');
  ok(await whoAmI(victimOld) === 'Celpont', 'a bevezetés előtti süti érvényes marad');
  // új ideiglenes jelszó: a régi belépés azonnal érvénytelen
  const reset = await post('/api/admin-users', { actionType: 'RESET_PASSWORD', payload: { userId: String(victim) } }, { cookie: ownerTok });
  ok(reset.status === 200, 'új ideiglenes jelszó kiadva');
  ok(await whoAmI(victimOld) === null, 'új ideiglenes jelszó után a régi belépés érvénytelen');
  // első jelszóbeállítás: a jelszószabály (lib/passwordPolicy.js)
  const { tempPassword } = await reset.json();
  const setup = (newPassword) => post('/api/auth', { action: 'complete_setup', loginId: 'Celpont', tempPassword, newPassword }, { ip: '10.4.0.1' });
  const withName = await setup('Celpont-2026-ok');
  ok(withName.status === 400 && /felhasználónevet/.test((await withName.json()).error), 'a felhasználónevet tartalmazó jelszó elutasítva');
  const common = await setup('jelszo123');
  ok(common.status === 400 && /gyakori/.test((await common.json()).error), 'a túl gyakori jelszó elutasítva');
  const good = await setup('kek-alma-zongora');
  ok(good.status === 200 && await whoAmI(cookieFrom(good)) === 'Celpont', 'jó jelszóval az első belépés sikerül');

  // valódi belépés két „eszközről”, majd kijelentkezés mindenhol
  const r1 = await login('Szervezo', 'Jelszo-12345', '10.0.0.2');
  const r2 = await login('Szervezo', 'Jelszo-12345', '10.0.0.3');
  const dev1 = cookieFrom(r1), dev2 = cookieFrom(r2);
  ok(dev1 && dev2 && await whoAmI(dev1) === 'Szervezo' && await whoAmI(dev2) === 'Szervezo', 'belépés két eszközről');
  const out = await post('/api/auth/logout', { everywhere: true }, { cookie: dev1, origin: BASE });
  ok(out.status === 200, 'kijelentkezés minden eszközről');
  ok(await whoAmI(dev1) === null && await whoAmI(dev2) === null, 'mindkét eszköz sütije érvénytelen');
  const audit = await db.collection('audit_logs').findOne({ action: 'KIJELENTKEZÉS', adminName: 'Szervezo' });
  ok(!!audit, 'naplózva');
  // sima kijelentkezés: a többi eszköz bent marad
  const r3 = cookieFrom(await login('Szervezo', 'Jelszo-12345', '10.0.0.4'));
  const r4 = cookieFrom(await login('Szervezo', 'Jelszo-12345', '10.0.0.5'));
  await post('/api/auth/logout', {}, { cookie: r3 });
  ok(await whoAmI(r4) === 'Szervezo', 'a sima kijelentkezés a többi eszközt nem érinti');

  // saját jelszó cseréje (tulajdonos): ezen az eszközön bent marad, a többin nem
  const o1 = cookieFrom(await login('Tulaj', 'Jelszo-12345', '10.0.0.6'));
  const o2 = cookieFrom(await login('Tulaj', 'Jelszo-12345', '10.0.0.7'));
  const ch = await post('/api/actions', { actionType: 'CHANGE_OWN_PASSWORD', payload: { currentPassword: 'Jelszo-12345', newPassword: 'Uj-Jelszo-678' } }, { cookie: o1 });
  const o1new = cookieFrom(ch);
  ok(ch.status === 200 && o1new && await whoAmI(o1new) === 'Tulaj', 'jelszócsere után ezen az eszközön bent marad (új süti)');
  ok(await whoAmI(o2) === null && await whoAmI(o1) === null, 'jelszócsere után a régi sütik érvénytelenek');
  const weird = await post('/api/actions', { actionType: 'CHANGE_OWN_PASSWORD', payload: { currentPassword: 'Uj-Jelszo-678', newPassword: { length: 10 } } }, { cookie: o1new });
  ok(weird.status === 400, 'nem szöveges új jelszó: 400');
  const weakOwn = await post('/api/actions', { actionType: 'CHANGE_OWN_PASSWORD', payload: { currentPassword: 'Uj-Jelszo-678', newPassword: '12345678' } }, { cookie: o1new });
  ok(weakOwn.status === 400 && /gyakori/.test((await weakOwn.json()).error), 'saját jelszó cseréjénél is: a túl gyakori jelszó elutasítva');
  ok(await whoAmI(o1new) === 'Tulaj', 'az elutasított csere nem léptet ki');

  // --- Hibás belépések fiókonként (más-más IP-ről is) ---
  for (let i = 0; i < 10; i++) await login('Szervezo', 'rossz-jelszo', `10.1.0.${i}`);
  const locked = await login('Szervezo', 'Jelszo-12345', '10.2.0.1');
  ok(locked.status === 429, `10 hibás próbálkozás után a fiók 15 percre zárva, más IP-ről is (${locked.status})`);
  const other = await login('Tulaj', 'Uj-Jelszo-678', '10.2.0.2');
  ok(other.status === 200, 'a többi fiók belépését nem érinti');
  const ghost = await login('nincsilyen', 'akarmi', '10.2.0.3');
  ok(ghost.status === 401, 'nem létező fiók: ugyanaz a „Hibás adatok” válasz');

  // --- Adatbázis-mentés: jelszó-hash és titkos kulcs nélkül ---
  await db.collection('settings').updateOne({ _id: 'push_vapid' }, { $set: { publicKey: 'nyilvanos-kulcs', privateKey: 'titkos-kulcs-123' } }, { upsert: true });
  const dump = await (await fetch(`${BASE}/api/export-db`, { headers: { Cookie: `tavern_session=${o1new}` } })).text();
  ok(dump.includes('nyilvanos-kulcs') && !dump.includes('titkos-kulcs-123'), 'a mentésben nincs benne a titkos (VAPID) kulcs');
  ok(dump.includes('"username": "Tulaj"') && !dump.includes('$2b$') && !dump.includes('"password"'), 'a mentésben nincs jelszó-hash');

  // --- Képfeltöltés: csak kép (a tulajdonos a jelszócsere után kapott új sütivel) ---
  const fd = new FormData();
  fd.append('image', new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], { type: 'image/svg+xml' }), 'x.svg');
  const svg = await fetch(`${BASE}/api/upload`, { method: 'POST', headers: { Cookie: `tavern_session=${o1new}` }, body: fd });
  ok(svg.status === 400, `SVG feltöltés elutasítva (${svg.status})`);
  const fd2 = new FormData();
  fd2.append('image', new Blob(['hello'], { type: 'text/html' }), 'x.html');
  const html = await fetch(`${BASE}/api/upload`, { method: 'POST', headers: { Cookie: `tavern_session=${o1new}` }, body: fd2 });
  ok(html.status === 400, `nem kép feltöltése elutasítva (${html.status})`);

  // --- Beágyazás ---
  const csp = async (path) => (await fetch(`${BASE}${path}`, { redirect: 'manual' })).headers.get('content-security-policy') || '';
  const booking = await csp('/asztalfoglalas?embed=1');
  ok(/frame-ancestors 'self' https:\/\/tavern\.hu https:\/\/\*\.tavern\.hu/.test(booking), `az asztalfoglalást csak a saját oldalak ágyazhatják be (${booking})`);
  ok(/frame-ancestors 'self'/.test(await csp('/jelentkezes/abc')), 'a jelentkezési oldal is');
  ok(!/frame-ancestors/.test(await csp('/embed')), 'a naptár (embed) továbbra is bárhová beágyazható');
  ok(/frame-ancestors 'none'/.test(await csp('/admin')), 'az admin sehova');

  // --- Felület: Kijelentkezés minden eszközről gomb ---
  const b = await browser();
  try {
    await db.collection('rate_limits').deleteMany({});
    const orgTok = cookieFrom(await login('Szervezo', 'Jelszo-12345', '10.3.0.1'));
    const p = await page(b, orgTok, 402, 874);
    await p.goto(`${BASE}/admin?lap=tovabbiak`, { waitUntil: 'networkidle2', timeout: 240000 });
    await p.waitForFunction(() => document.body.innerText.includes('Kijelentkezés minden eszközről'), { timeout: 60000 });
    await clickText(p, 'button', 'Kijelentkezés minden eszközről');
    await p.waitForSelector('.ant-popconfirm .ant-btn-dangerous', { visible: true, timeout: 10000 });
    await p.evaluate(() => document.querySelector('.ant-popconfirm .ant-btn-dangerous').click()); // (a buborék még nyílik)
    await wait(1500);
    ok(await whoAmI(orgTok) === null, 'a gombbal minden eszközről kijelentkezik');
    ok(p.errs.length === 0, `nincs hiba az oldalon (${p.errs.join(' | ')})`);
  } finally {
    await b.close();
  }
} finally {
  await client.close();
  summary();
}
