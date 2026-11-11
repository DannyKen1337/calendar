// Közösségi esemény (pl. Pokeween): az admin boltonként létrehozza, és automatikusan lefoglal X helyet. A telítettségbe
// azonnal beleszámít; a nyilvános naptárban csak a neve és a leírása látszik, a helyszám nem.
import { openDb, token, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';

const { client, db } = await openDb();
const owner = (await db.collection('users').insertOne({ username: 'Tulaj', email: 'o@x.hu', password: 'x', role: 'owner', lastSeenChangelog: '9999' })).insertedId;
await db.collection('settings').insertOne({ _id: 'global_settings', occupancy: { enabled: true, public: true, capacity: { debrecen: 60 } } });
const pad = (n) => String(n).padStart(2, '0');
const day = (o) => { const d = new Date(); d.setDate(d.getDate() + o); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const tok = await token(owner, 'Tulaj', 'owner');
const act = async (actionType, payload) => {
  const res = await fetch(`${BASE}/api/actions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `tavern_session=${tok}` }, body: JSON.stringify({ actionType, payload }) });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const base = { name: 'Pokeween', category: 'Pokémon TCG', store: 'debrecen', date: `${day(0)}T23:00`, eventType: 'community', description: 'Jelmezes Pokémon-este az egész családnak.' };

const b = await browser();
try {
  // mentés
  const bad = await act('ADD_TOURNAMENT', { ...base });
  ok(bad.status === 400 && /hely/i.test(bad.body.error || ''), `helyszám nélkül nem menthető (${bad.body.error})`);
  const good = await act('ADD_TOURNAMENT', { ...base, reservedSeats: 30, max_players: 16 });
  ok(good.status === 200 && good.body.success, 'közösségi esemény 30 hellyel mentve');
  const saved = await db.collection('tournaments').findOne({ name: 'Pokeween' });
  ok(saved?.reservedSeats === 30 && saved.isOpenAttendance === true && saved.max_players === 0, 'jelentkezés nélküli, 30 lefoglalt hellyel');
  const edited = await act('EDIT_TOURNAMENT', { id: String(saved._id), reservedSeats: 25 });
  ok(edited.status === 200 && (await db.collection('tournaments').findOne({ _id: saved._id })).reservedSeats === 25, 'a helyszám szerkeszthető');

  // nyilvános adat: a helyszám nem kerül ki, de az összesített telítettségbe beleszámít
  const pub = await (await fetch(`${BASE}/api/public-data`)).json();
  const pubEvt = pub.tournaments.find(t => t.name === 'Pokeween');
  ok(pubEvt && pubEvt.reservedSeats === undefined, 'a nyilvános adatban nincs helyszám');
  ok(pub.occupancy?.reserved?.[`debrecen|${day(0)}`] === 25, 'a nyilvános telítettség összegében benne van (név nélkül)');

  // nyilvános naptár: név és leírás, helyszám nélkül
  const p = await page(b, null, 402, 874);
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem('tavern_selected_store', 'debrecen'); } catch { /* */ } });
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 240000 });
  await p.waitForSelector('[aria-label="Előző hónap"]', { timeout: 60000 });
  await wait(500);
  const row = await p.evaluate(() => [...document.querySelectorAll('[data-ujsor]')].map(l => l.textContent).find(t => t.includes('Pokeween')) || '');
  ok(row && !/25|kötetlen/.test(row), `nyilvános sor: név, helyszám és „kötetlen” nélkül (${row})`);
  ok(await p.evaluate(() => /25 \/ 60/.test(document.body.innerText)), 'nyilvános napi telítettség: 25 / 60');
  await p.evaluate(() => [...document.querySelectorAll('[data-ujsor] button')].find(x => x.textContent.includes('Pokeween')).click());
  await wait(700);
  const modal = await p.evaluate(() => document.querySelector('.ant-modal-container')?.innerText || '');
  ok(/Jelmezes Pokémon-este/.test(modal) && !/25/.test(modal), 'a részletekben a leírás látszik, a helyszám nem');

  // admin: a kártyán a lefoglalt helyek, a telítettség azonnal kitöltve
  const a = await page(b, tok, 402, 874);
  await a.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
  await a.waitForFunction(() => document.body.innerText.includes('Pokeween'), { timeout: 60000 });
  const card = await a.evaluate(() => [...document.querySelectorAll('[data-kartya]')].map(c => c.innerText).find(t => t.includes('Pokeween')) || '');
  ok(/25 hely/.test(card) && /Közösségi/i.test(card), `admin kártya: közösségi, 25 hely (${card.replace(/\n/g, ' ')})`);
  ok(await a.evaluate(() => /25\s*\/\s*60/.test(document.body.innerText)), 'admin: a mai telítettség 25 / 60');

  // admin űrlap: közösségi típusnál a „Lefoglalt helyek” mező
  await a.evaluate(() => [...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === 'Új esemény').click());
  await a.waitForSelector('.ant-modal-container', { timeout: 10000 });
  await wait(400);
  await a.evaluate(() => { const item = [...document.querySelectorAll('.ant-form-item')].find(i => i.textContent.includes('Esemény típusa')); const sel = item.querySelector('.ant-select'); (sel.querySelector('input') || sel).dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); sel.click(); });
  await wait(400);
  await a.evaluate(() => [...document.querySelectorAll('.ant-select-item-option')].find(o => o.textContent.includes('Közösségi')).click());
  await wait(400);
  ok(await a.evaluate(() => [...document.querySelectorAll('.ant-form-item label')].some(l => /Lefoglalt helyek/.test(l.textContent))), 'űrlap: közösségi típusnál „Lefoglalt helyek” mező');
  await a.screenshot({ path: `${SHOTS}kozossegi-urlap.jpg`, quality: 60 });
  console.log('  böngészőhibák:', [...p.errs, ...a.errs].join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
