// E-mail cím ellenőrzése (MX lookup): mentés előtt a szerver megnézi, fogad-e levelet a cím domainje. Nem létező domain,
// „null MX”, MX és A rekord nélküli domain: elutasítva, a mezőnél érthető hibával; gyakori elírásnál (gmial.com)
// javaslat; ha a DNS nem válaszol, átengedi. A tesztszerver hamis DNS-feloldóval fut (EMAIL_MX_FAKE, lib/emailDomain.js).
import { openDb, token, browser, page, ok, summary, SHOTS, BASE } from './lib.mjs';

const { client, db } = await openDb();
const pad = (n) => String(n).padStart(2, '0');
const day = (o) => { const d = new Date(); d.setDate(d.getDate() + o); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const ev = String((await db.collection('tournaments').insertOne({ name: 'MX teszt verseny', date: `${day(3)}T18:00`, category: 'Pokémon TCG', store: 'debrecen', max_players: 20, current_players: 0, is_open: true })).insertedId);
const prod = String((await db.collection('preorder_products').insertOne({ name: 'MX doboz', category: 'Pokémon TCG', perPersonLimit: 0, isOpen: true, createdAt: new Date() })).insertedId);
const owner = (await db.collection('users').insertOne({ username: 'MxTulaj', email: 'mx@x.hu', password: 'x', role: 'owner', lastSeenChangelog: '9999' })).insertedId;
const tok = await token(owner, 'MxTulaj', 'owner');
const post = async (path, body, cookie) => { const r = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie && { Cookie: `tavern_session=${cookie}` }) }, body: JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => ({})) }; };
const join = (email, username) => post('/api/actions', { actionType: 'JOIN_TOURNAMENT', payload: { tournamentId: ev, username, name: 'Teszt Elek', email } });

const b = await browser();
try {
  // jelentkezés
  const nx = await join('elek@nincs-level.hu', 'Elek1');
  ok(nx.status === 400 && nx.data.field === 'email' && /nem létezik/.test(nx.data.error), `nem létező domain: elutasítva a mezőnél (${nx.data.error})`);
  const nullmx = await join('elek@null-mx.hu', 'Elek2');
  ok(nullmx.status === 400 && /nem fogad leveleket/.test(nullmx.data.error), 'a levelet nem fogadó domain (null MX) elutasítva');
  const typo = await join('elek@gmial.com', 'Elek3');
  ok(typo.status === 400 && typo.data.suggestion === 'elek@gmail.com' && /Erre gondoltál: elek@gmail\.com\?/.test(typo.data.error), 'elírásnál javaslat (gmial.com → gmail.com)');
  ok((await join('elek@csak-a.hu', 'Elek4')).status === 200, 'MX nélkül, A rekorddal elfogadva');
  ok((await join('elek@dns-hiba.hu', 'Elek5')).status === 200, 'ha a DNS nem válaszol, átengedi');
  ok((await join('elek@pelda.hu', 'Elek6')).status === 200, 'rendes cím: elfogadva');
  ok((await db.collection('registrations').countDocuments({ tournamentId: ev })) === 3, 'csak az elfogadott jelentkezések kerültek be');

  // a többi űrlap
  const pre = await post('/api/preorders', { name: 'Teszt Elek', email: 'elek@nincs-level.hu', phone: '+36 30 123 4567', items: [{ productId: prod, quantity: 1 }] });
  ok(pre.status === 400 && pre.data.field === 'email' && !(await db.collection('preorders').findOne({ productId: prod })), 'előrendelés: elutasítva, nem került be');
  // (a kérdés űrlapját a levelezős kör ellenőrzi: elorendeles-kerdes)
  // asztalfoglalás: egy nyitvatartási napon
  let tb = null;
  for (let o = 1; o <= 8 && (!tb || /zárva|nyitva/.test(tb.data.error || '')); o++) {
    tb = await post('/api/table-bookings', { name: 'Teszt Elek', email: 'elek@nincs-level.hu', phone: '+36 30 123 4567', store: 'debrecen', date: day(o), from: '16:00', to: '18:00', maxPeople: 4 });
  }
  ok(tb.status === 400 && tb.data.field === 'email' && !(await db.collection('table_bookings').findOne({ email: 'elek@nincs-level.hu' })), `asztalfoglalás: elutasítva, nem került be (${tb.data.error})`);
  const nu = await post('/api/admin-users', { actionType: 'CREATE_USER', payload: { username: 'MxSzervezo', email: 'szervezo@null-mx.hu', role: 'admin', groupIds: [] } }, tok);
  ok(nu.status === 400 && nu.data.field === 'email', 'admin, új fiók: elutasítva');
  const add = await post('/api/actions', { actionType: 'ADMIN_ADD_REGISTRATION', payload: { tournamentId: ev, username: 'Kezi', name: 'Kézi Kati', email: 'kati@nincs-level.hu' } }, tok);
  ok(add.status === 400 && add.data.field === 'email', 'admin, kézi jelentkező: hibás cím elutasítva');
  ok((await post('/api/actions', { actionType: 'ADMIN_ADD_REGISTRATION', payload: { tournamentId: ev, username: 'Kezi2', name: 'Kézi Kata' } }, tok)).status === 200, 'admin, kézi jelentkező e-mail nélkül továbbra is felvehető');

  // a jelentkezési oldalon: a hiba az e-mail mezőnél, a javaslattal
  const p = await page(b, null, 402, 874);
  await p.goto(`${BASE}/jelentkezes/${ev}`, { waitUntil: 'networkidle2', timeout: 240000 });
  await p.waitForSelector('input[autocomplete="email"]', { timeout: 30000 });
  const fill = async (sel, v) => { await p.$eval(sel, el => { el.value = ''; }); await p.type(sel, v); };
  const usernameSel = await p.$('input[autocomplete="nickname"]') ? 'input[autocomplete="nickname"]' : 'input[name="username"], #username, input[maxlength="24"]';
  await fill(usernameSel, 'Felulet1');
  await fill('input[autocomplete="name"]', 'Felület Feri');
  await fill('input[autocomplete="email"]', 'feri@gmial.com');
  await p.evaluate(() => { document.querySelectorAll('input[type=checkbox]').forEach(c => { if (!c.checked && c.offsetParent) c.click(); }); });
  await p.evaluate(() => [...document.querySelectorAll('button')].find(x => x.type === 'submit')?.click());
  await p.waitForFunction(() => /Erre gondoltál/.test(document.body.innerText), { timeout: 20000 }).catch(() => {});
  const near = await p.evaluate(() => {
    const input = document.querySelector('input[autocomplete="email"]');
    const box = input?.closest('[data-mezo]') || input?.parentElement?.parentElement;
    return { text: box?.innerText || '', invalid: input?.getAttribute('aria-invalid') };
  });
  ok(/Erre gondoltál: feri@gmail\.com\?/.test(near.text), `a jelentkezési oldalon a hiba az e-mail mezőnél, javaslattal (${near.text.replace(/\n/g, ' ').slice(0, 90)})`);
  await p.screenshot({ path: `${SHOTS}email-ellenorzes.jpg`, quality: 60 });
  console.log('  böngészőhibák:', p.errs.join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
