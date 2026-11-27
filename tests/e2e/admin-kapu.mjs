// Rejtett admin (lib/adminGate.js, proxy.js): a szerver ADMIN_PATH=/kapu-teszt-2026 beállítással fut (run.mjs külön kör).
// Kapu nélkül az admin, a weboldal szerkesztője és a belépés 404 (az előtöltés fejlécével sem kerülhető meg); a titkos
// cím kaput nyit és az adminra visz; aki be van lépve, azt átengedi (és kapu-sütit kap); a nyilvános oldalak változatlanok.
import bcrypt from 'bcryptjs';
import { openDb, token, browser, page, ok, summary, wait, BASE } from './lib.mjs';

const GATE = '/kapu-teszt-2026';
const { client, db } = await openDb();
await db.collection('users').insertOne({ username: 'Tulaj', email: 'o@x.hu', password: await bcrypt.hash('Jelszo-12345', 10), role: 'owner', lastSeenChangelog: '9999' });
const owner = await db.collection('users').findOne({ username: 'Tulaj' });
const ownerTok = await token(owner._id, 'Tulaj', 'owner');

const req = (path, { cookie, headers = {}, method = 'GET', body } = {}) => fetch(`${BASE}${path}`, {
  method, redirect: 'manual', body,
  headers: { ...headers, ...(cookie && { Cookie: cookie }), ...(body && { 'Content-Type': 'application/json' }) },
});
const gateFrom = (res) => (res.headers.get('set-cookie') || '').match(/tavern_kapu=([^;]+)/)?.[1] || null;
const login = (cookie) => req('/api/auth', { method: 'POST', cookie, body: JSON.stringify({ action: 'login', loginId: 'Tulaj', password: 'Jelszo-12345' }) });

try {
  // --- Kapu nélkül: mintha nem is létezne ---
  for (const path of ['/admin', '/admin/liga', '/admin/felhasznalok', '/weblapteszt/admin', '/weblapteszt/elonezet']) {
    const res = await req(path);
    ok(res.status === 404, `${path}: 404 (${res.status})`);
  }
  const notFound = await (await req('/admin')).text();
  const random = await (await req('/nincs-ilyen-oldal-sehol')).text();
  const title = (html) => html.match(/<title>([^<]*)<\/title>/)?.[1];
  ok(!/Bejelentkezés|Tavern Admin/.test(notFound) && title(notFound) === title(random), 'ugyanaz a 404-es oldal, mint egy nem létező címen');
  const prefetch = await req('/admin', { headers: { 'next-router-prefetch': '1', RSC: '1' } });
  ok(prefetch.status === 404, `az előtöltés (prefetch / RSC) fejlécével sem kerülhető meg (${prefetch.status})`);
  const noGateLogin = await login();
  ok(noGateLogin.status === 404, `kapu nélkül a belépés API is 404 (${noGateLogin.status})`);
  ok((await req('/api/auth/session')).status === 200, 'a munkamenet lekérdezése (nyilvános oldalak) működik');
  for (const path of ['/', '/naptar', '/embed', `/esemeny/x`]) {
    const res = await req(path);
    ok(res.status !== 404 || path.startsWith('/esemeny'), `nyilvános oldal változatlan: ${path} (${res.status})`);
  }
  const fakeGate = await req('/admin', { cookie: 'tavern_kapu=hamis-ertek' });
  ok(fakeGate.status === 404, 'hamis kapu-sütivel: 404');

  // --- A titkos cím ---
  const open = await req(GATE);
  const gate = gateFrom(open);
  ok([302, 303, 307, 308].includes(open.status) && new URL(open.headers.get('location'), BASE).pathname === '/admin', `a titkos cím az adminra visz (${open.status} → ${open.headers.get('location')})`);
  ok(!!gate && /HttpOnly/i.test(open.headers.get('set-cookie')), 'és HttpOnly kapu-sütit ad');
  ok(/noindex/.test(open.headers.get('x-robots-tag') || ''), 'a keresők nem indexelik');
  const withGate = await req('/admin', { cookie: `tavern_kapu=${gate}` });
  ok(withGate.status === 200, `kapu-sütivel megnyílik az admin (belépő) oldal (${withGate.status})`);
  const gatedLogin = await login(`tavern_kapu=${gate}`);
  ok(gatedLogin.status === 200, `kapu-sütivel a belépés működik (${gatedLogin.status})`);
  ok((await req('/weblapteszt/admin', { cookie: `tavern_kapu=${gate}` })).status !== 404, 'a weboldal szerkesztője is elérhető');

  // --- Aki már be van lépve, azt nem zárja ki ---
  const loggedIn = await req('/admin', { cookie: `tavern_session=${ownerTok}` });
  ok(loggedIn.status === 200, `belépett felhasználó kapu-süti nélkül is bejut (${loggedIn.status})`);
  ok(!!gateFrom(loggedIn), 'és kapu-sütit kap (kilépés után is megtalálja a belépő oldalt)');

  // --- Böngészőben: a titkos link → belépés → admin ---
  const b = await browser();
  try {
    const p = await page(b, null);
    await p.goto(`${BASE}${GATE}`, { waitUntil: 'networkidle2', timeout: 240000 });
    ok(new URL(p.url()).pathname === '/admin', `a böngésző az /admin címre kerül (${p.url()})`);
    await p.waitForSelector('input[type=password]', { timeout: 60000 });
    const inputs = await p.$$('input');
    await inputs[0].type('Tulaj');
    await p.type('input[type=password]', 'Jelszo-12345');
    await p.keyboard.press('Enter');
    await p.waitForFunction(() => /Események|Továbbiak/.test(document.body.innerText) && !document.querySelector('input[type=password]'), { timeout: 60000 });
    ok(true, 'belépés után az admin betölt');
    // kilépés után a belépő oldal továbbra is elérhető (a kapu-süti megmarad)
    await p.deleteCookie({ name: 'tavern_session', domain: 'localhost' });
    const p2 = await page(b, null);
    const again = await p2.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
    await p2.waitForSelector('input[type=password]', { timeout: 60000 }).catch(() => {});
    ok(again.status() === 200 && !!(await p2.$('input[type=password]')), 'kilépés után ugyanabban a böngészőben a sima /admin is a belépő oldalt adja');
    ok(p.errs.length === 0, `nincs hiba az oldalon (${p.errs.join(' | ')})`);
    // másik böngésző (új profil): a sima /admin 404
    const other = await browser();
    try {
      const q = await (await other.createBrowserContext()).newPage();
      const res = await q.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
      ok(res.status() === 404, `másik böngészőben a sima /admin 404 (${res.status()})`);
    } finally { await other.close(); }
  } finally {
    await b.close();
  }
  await wait(10);
} finally {
  await client.close();
  summary();
}
