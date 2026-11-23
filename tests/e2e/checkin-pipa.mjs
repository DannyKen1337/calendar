// Telefonos check-in: a „Megjelent” pipa kattintásra azonnal megjelenik, és nem tűnik el akkor sem, ha közben egy
// (a mentés előtt indult, lassú) háttérfrissítés a régi állapotot hozza vissza. Gyors egymás utáni jelölésnél sem villog.
import { openDb, token, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';

const { client, db } = await openDb();
const owner = (await db.collection('users').insertOne({ username: 'Tulaj', email: 'o@x.hu', password: 'x', role: 'owner', lastSeenChangelog: '9999' })).insertedId;
const pad = (n) => String(n).padStart(2, '0');
const d = new Date();
const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ev = (await db.collection('tournaments').insertOne({ name: 'Pokémon klubnap', date: `${today}T23:30`, category: 'Pokémon TCG', store: 'debrecen', max_players: 16, current_players: 3, is_open: true, createdAt: new Date() })).insertedId;
await db.collection('registrations').insertMany(['Ash', 'Misty', 'Brock'].map((u, i) => ({ tournamentId: String(ev), username: u, name: u, status: 'Aktív', date: new Date(Date.now() - (3 - i) * 1000) })));
const tok = await token(owner, 'Tulaj', 'owner');

const b = await browser();
try {
  const p = await page(b, tok, 402, 874);
  await p.goto(`${BASE}/admin/checkin?event=${ev}`, { waitUntil: 'networkidle2', timeout: 240000 });
  await p.waitForSelector('button[aria-label="Megjelent"]', { timeout: 60000 });
  // Lassú szerver: az admin-adat lekérés válasza 1,5 mp-et késik (a régi állapotot hozza, ha a mentés előtt indult)
  await p.setRequestInterception(true);
  // a szerver a kérés pillanatában olvassa ki az adatot, de a válasz csak 1,5 mp múlva ér vissza
  p.on('request', async (req) => {
    if (!req.url().includes('/api/admin-data')) { req.continue().catch(() => {}); return; }
    const res = await fetch(req.url(), { headers: { Cookie: `tavern_session=${tok}` } });
    const body = await res.text();
    setTimeout(() => req.respond({ status: res.status, contentType: 'application/json', body }).catch(() => {}), 1500);
  });
  // a gomb saját (inline) stílusa: a valódi állapot, a színátmenet nélkül
  const ticks = () => p.$$eval('button[aria-label="Megjelent"]', bs => bs.map(x => /56, 158, 13|389e0d/i.test(x.style.background || x.style.backgroundColor)));
  const watch = async (ms, idx) => { const seen = []; const end = Date.now() + ms; while (Date.now() < end) { seen.push((await ticks())[idx]); await wait(80); } return seen; };

  // háttérfrissítés indul (fókusz), közben jelölünk
  await wait(2200);
  await p.evaluate(() => window.dispatchEvent(new Event('focus')));
  await wait(100);
  const btns = await p.$$('button[aria-label="Megjelent"]');
  await btns[0].click();
  const seen = await watch(3500, 0);
  ok(seen.length > 10 && seen.every(Boolean), `a pipa végig megmarad, nem villog (${seen.filter(x => !x).length} kihagyás ${seen.length} mintából)`);

  // gyorsan egymás után két jelölés: mindkettő megmarad
  const all = await p.$$('button[aria-label="Megjelent"]');
  await all[1].click();
  await wait(150);
  await all[2].click();
  const s1 = await watch(3500, 1), s2 = await watch(500, 2);
  ok(s1.every(Boolean) && s2.every(Boolean), 'gyors egymás utáni jelölésnél sem tűnik el a pipa');
  const saved = await db.collection('registrations').find({ tournamentId: String(ev) }).toArray();
  ok(saved.every(r => r.attended === true), 'mindhárom jelölés elmentve');

  // visszavonás is azonnal és véglegesen
  await (await p.$$('button[aria-label="Megjelent"]'))[0].click();
  const off = await watch(3000, 0);
  ok(off.every(x => !x) && (await db.collection('registrations').findOne({ username: 'Ash' })).attended === undefined, 'a pipa visszavonása sem ugrik vissza');
  await p.screenshot({ path: `${SHOTS}checkin-pipa.jpg`, quality: 60 });
  console.log('  böngészőhibák:', p.errs.join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
