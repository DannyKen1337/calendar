// Content-Security-Policy (proxy.js, lib/csp.js): kérésenként új nonce, a Next scriptjei megkapják; a szerver válaszába
// becsempészett script (mintha egy XSS-hiba miatt kerülne az oldalba) nem fut le, idegen script nem töltődik be, az
// onerror="…" és a javascript: link sem fut; a weboldal saját inline scriptje (töltőképernyő) a nonce-szal fut;
// a szerkesztőfelületen van eval (HEIC-átalakító), a nyilvános oldalakon nincs; a böngésző jelentései a naplóba kerülnek.
import { openDb, token, browser, page, ok, summary, wait, BASE } from './lib.mjs';

const { client, db } = await openDb();
const owner = (await db.collection('users').insertOne({ username: 'Tulaj', email: 'o@x.hu', password: 'x', role: 'owner', lastSeenChangelog: '9999' })).insertedId;
const ownerTok = await token(owner, 'Tulaj', 'owner');
const ev = (await db.collection('tournaments').insertOne({ name: 'CSP próbaverseny', date: '2030-05-04T18:00', category: 'Pokémon TCG', store: 'debrecen', max_players: 16, current_players: 0, queue_count: 0, is_open: true, created_at: new Date() })).insertedId;
const cspOf = async (path, cookie) => {
  const res = await fetch(`${BASE}${path}`, { headers: cookie ? { Cookie: `tavern_session=${cookie}` } : {}, redirect: 'manual' });
  return { csp: res.headers.get('content-security-policy') || '', html: await res.text() };
};
const scriptSrc = (csp) => csp.split('; ').find(d => d.startsWith('script-src ')) || '';

try {
  // --- Fejléc és nonce ---
  const a = await cspOf('/'), b2 = await cspOf('/');
  const nonceA = scriptSrc(a.csp).match(/'nonce-([^']+)'/)?.[1];
  const nonceB = scriptSrc(b2.csp).match(/'nonce-([^']+)'/)?.[1];
  ok(!!nonceA && !!nonceB && nonceA !== nonceB, 'minden kérés új nonce-ot kap');
  ok(/'strict-dynamic'/.test(scriptSrc(a.csp)) && !/unsafe-inline/.test(scriptSrc(a.csp)), "script-src: nonce + 'strict-dynamic', 'unsafe-inline' nélkül");
  const scripts = [...a.html.matchAll(/<script\b[^>]*>/g)].map(m => m[0]);
  ok(scripts.length > 0 && scripts.every(t => t.includes(`nonce="${nonceA}"`)), `a Next minden scriptje megkapja a nonce-ot (${scripts.length} db)`);
  ok(/object-src 'none'/.test(a.csp) && /base-uri 'self'/.test(a.csp) && /form-action 'self'/.test(a.csp), "object-src 'none', base-uri, form-action");
  ok(/report-uri \/api\/csp-report/.test(a.csp), 'a sértéseket a /api/csp-report címre jelenti');
  const adminCsp = (await cspOf('/admin', ownerTok)).csp;
  ok(/frame-ancestors 'none'/.test(adminCsp), 'admin: nem ágyazható be');
  const ev1 = (await cspOf(`/esemeny/${ev}`)).csp;
  ok(/frame-ancestors 'self' https:\/\/tavern\.hu/.test(ev1), 'eseményoldal: csak a saját oldalaink ágyazhatják be');
  ok(!/frame-ancestors/.test((await cspOf('/embed')).csp), 'a naptár (embed) bárhová beágyazható');
  const web = await cspOf('/');
  const webNonce = scriptSrc(web.csp).match(/'nonce-([^']+)'/)?.[1];
  ok(!!webNonce && web.html.includes(`<script nonce="${webNonce}">try{var d=document`), 'a weboldal töltőképernyő-szkriptje a kérés nonce-át kapja');
  const api = await fetch(`${BASE}/api/public-data`);
  ok(!api.headers.get('content-security-policy'), 'az API válaszai nem kapnak CSP-t (nem HTML)');

  // --- Becsempészett scriptek: a szerver válaszát módosítjuk, mintha egy XSS-hiba miatt kerülnének az oldalba ---
  const b = await browser();
  try {
    const p = await page(b, null, 1280, 900, { cspProbe: true });
    let evilRequested = false;
    await p.setRequestInterception(true);
    p.on('request', async (req) => {
      if (req.url().startsWith('https://gonosz.example/')) { evilRequested = true; req.respond({ status: 200, contentType: 'text/javascript', body: 'window.__pwnedRemote = 1' }).catch(() => {}); return; }
      if (req.resourceType() !== 'document' || !req.url().includes(`/esemeny/${ev}`)) { req.continue().catch(() => {}); return; }
      const res = await fetch(req.url());
      const html = (await res.text()).replace('</body>', [
        '<script>window.__pwnedInline = 1</script>',
        '<script src="https://gonosz.example/x.js"></script>',
        '<img src="/nincs-ilyen.png" onerror="window.__pwnedHandler = 1">',
        '<a id="gonosz-link" href="javascript:window.__pwnedLink = 1">katt</a>',
        '</body>',
      ].join(''));
      const headers = Object.fromEntries([...res.headers].filter(([k]) => !['content-length', 'content-encoding', 'transfer-encoding'].includes(k)));
      req.respond({ status: res.status, headers, body: html }).catch(() => {});
    });
    await p.goto(`${BASE}/esemeny/${ev}`, { waitUntil: 'networkidle2', timeout: 240000 });
    await p.waitForFunction(() => document.body.innerText.includes('CSP próbaverseny'), { timeout: 60000 });
    await p.click('#gonosz-link').catch(() => {});
    await wait(800);
    const pwned = await p.evaluate(() => ({ inline: window.__pwnedInline, remote: window.__pwnedRemote, handler: window.__pwnedHandler, link: window.__pwnedLink }));
    ok(pwned.inline === undefined, 'a becsempészett inline <script> nem fut le');
    ok(pwned.remote === undefined && !evilRequested, 'idegen oldalról script nem töltődik be (le sem kéri)');
    ok(pwned.handler === undefined, 'az onerror="…" nem fut le');
    ok(pwned.link === undefined, 'a javascript: link nem fut le');
    ok(p.csp.length >= 3, `a böngésző jelzi a letiltást (${p.csp.length} üzenet)`);
    // az oldal ettől még működik: a saját scriptjeink futnak (kliensoldali gomb)
    ok(await p.evaluate(() => !!document.querySelector('a[href*="/jelentkezes/"], button')), 'az eseményoldal közben működik');

    // a weboldal töltőképernyője (saját inline script, nonce-szal) lefut
    const w = await page(b, null, 1280, 900, { intro: true });
    await w.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 240000 });
    ok(await w.evaluate(() => document.documentElement.dataset.tolto === 'fut'), 'a weboldal saját inline scriptje (töltőképernyő) lefut');
    ok(w.csp.length === 0, 'a weboldalon nincs letiltott tartalom');
  } finally {
    await b.close();
  }

  // --- A böngésző jelentése a naplóba kerül ---
  const report = (body, type = 'application/csp-report') => fetch(`${BASE}/api/csp-report`, { method: 'POST', headers: { 'Content-Type': type }, body: JSON.stringify(body) });
  const r1 = await report({ 'csp-report': { 'document-uri': `${BASE}/leiratkozas?token=titok123`, 'effective-directive': 'script-src-elem', 'blocked-uri': 'https://gonosz.example/x.js?a=1' } });
  await report({ 'csp-report': { 'document-uri': `${BASE}/`, 'effective-directive': 'script-src', 'blocked-uri': 'chrome-extension://abc/x.js' } });
  await report([{ type: 'csp-violation', body: { documentURL: `${BASE}/elorendeles`, effectiveDirective: 'img-src', blockedURL: 'http://kep.example/a.png' } }], 'application/reports+json');
  ok(r1.status === 204, 'a jelentő végpont 204-gyel válaszol');
  await wait(300);
  // (a fenti próbaoldal letiltásait a böngésző is jelentette: azok is itt vannak)
  const logged = await db.collection('system_errors').find({ source: 'csp' }).toArray();
  ok(logged.some(l => l.message.includes('gonosz.example/x.js')) && logged.some(l => l.message.includes('kep.example')), 'a jelentések a Rendszer oldal hibái közé kerülnek (mindkét formátum)');
  ok(!logged.some(l => l.message.includes('chrome-extension')), 'a böngészőbővítmények jelentése kimarad');
  ok(logged.some(l => l.message.includes('/esemeny/') && /inline|gonosz/.test(l.message)), 'a böngésző valódi jelentése is beérkezett a becsempészett scriptről');
  ok(logged.some(l => l.message.includes('https://gonosz.example/x.js') && l.message.includes('/leiratkozas') && !JSON.stringify(l).includes('titok123')), 'a naplóban nincs benne a lekérdezés (token)');
} finally {
  await client.close();
  summary();
}
