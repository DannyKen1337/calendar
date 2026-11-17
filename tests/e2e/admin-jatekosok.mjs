// Admin: játékos bázis játékonként. A jelentkezésekből magától bővül (e-mail vagy név szerint; Riftboundnál csak az
// idézőnév, a külső jelentkezőkkel együtt), csak a kezelt játékok látszanak, az e-mail cím csak 2. szinten; kézzel
// szerkeszthető (Pokémonnál Player ID), felvehető, törölhető. Gépen táblázat, telefonon kártyák.
import { openDb, token, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';

const { client, db } = await openDb();
const ids = (await db.collection('users').insertMany([
  { username: 'Pokis', email: 'p@x.hu', password: 'x', role: 'admin', allowedCategories: ['Pokémon TCG'], features: ['personalBasic'], lastSeenChangelog: '9999' },
  { username: 'Rifti', email: 'r@x.hu', password: 'x', role: 'admin', allowedCategories: ['Riftbound'], features: ['personalBasic'], lastSeenChangelog: '9999' },
  { username: 'Kettes', email: 'k@x.hu', password: 'x', role: 'admin', allowedCategories: ['Pokémon TCG'], features: ['personalBasic', 'personalData'], lastSeenChangelog: '9999' },
])).insertedIds;
const tok = { pk: await token(ids[0], 'Pokis', 'admin'), rb: await token(ids[1], 'Rifti', 'admin'), l2: await token(ids[2], 'Kettes', 'admin') };
const ev = (await db.collection('tournaments').insertMany([
  { name: 'Pokémon Liga 1', date: '2026-10-01T18:00', category: 'Pokémon TCG', store: 'debrecen', max_players: 16 },
  { name: 'Pokémon Liga 2', date: '2026-10-08T18:00', category: 'Pokémon TCG', store: 'debrecen', max_players: 16 },
  { name: 'Riftbound klub', date: '2026-10-02T18:00', category: 'Riftbound', store: 'debrecen', max_players: 16 },
  { name: 'Riftbound Skirmish', date: '2026-10-09T18:00', category: 'Riftbound', store: 'debrecen', external_url: 'https://example.com/rgn' },
  { name: 'Magic este', date: '2026-10-03T18:00', category: 'Magic: The Gathering', store: 'debrecen', max_players: 8 },
])).insertedIds;
const reg = (t, r, d) => ({ tournamentId: String(ev[t]), status: 'Aktív', date: new Date(d), ...r });
await db.collection('registrations').insertMany([
  reg(0, { username: 'Ash', name: 'Kovács Ádám', email: 'ash.titkos@pelda.hu' }, '2026-09-25'),
  reg(0, { username: 'Misty', name: 'Nagy Bianka' }, '2026-09-26'),
  reg(1, { username: 'Ashy', name: 'Kovács Ádám', email: 'ASH.titkos@pelda.hu' }, '2026-10-02'),
  reg(1, { username: 'misty', name: 'Nagy Bianka' }, '2026-10-03'),
  reg(1, { username: 'Brock', name: 'Tóth Bence', email: 'brock@pelda.hu' }, '2026-10-04'),
  reg(2, { username: 'Jinx#HUN', name: 'Szabó Lili', email: 'jinx@pelda.hu' }, '2026-09-28'),
  reg(4, { username: 'Jace', name: 'Jace', email: 'jace@pelda.hu' }, '2026-09-29'),
]);
await db.collection('external_registrations').insertMany([
  { tournamentId: String(ev[3]), source: 'rgn', name: 'Garen#EUNE', status: 'active', firstSeenAt: new Date('2026-10-05') },
  { tournamentId: String(ev[3]), source: 'rgn', name: 'jinx#hun', status: 'active', firstSeenAt: new Date('2026-10-06') },
]);
const api = async (path, t, body) => { const r = await fetch(`${BASE}${path}`, { method: body ? 'POST' : 'GET', headers: { Cookie: `tavern_session=${t}`, ...(body && { 'Content-Type': 'application/json' }) }, body: body && JSON.stringify(body) }); return { status: r.status, text: await r.text() }; };
const list = async (t, game = '') => { const r = await api(`/api/players?jatek=${encodeURIComponent(game)}`, t); return { ...JSON.parse(r.text), raw: r.text, status: r.status }; };

const b = await browser();
try {
  const pk = await list(tok.pk);
  ok(pk.category === 'Pokémon TCG' && pk.games.length === 1 && pk.games[0].category === 'Pokémon TCG', 'a Pokémon szervező csak a Pokémon listát látja');
  const by = (l, n) => l.players.find(p => p.username === n || p.summoner === n);
  ok(pk.players.length === 3 && by(pk, 'Ash')?.events === 2 && by(pk, 'Misty')?.events === 2 && by(pk, 'Brock')?.events === 1, `e-mail és név szerint összevonva: Ash 2, Misty 2, Brock 1 (${pk.players.map(p => `${p.username} ${p.events}`).join(', ')})`);
  ok(by(pk, 'Ash').lastEvent === 'Pokémon Liga 2', 'az utolsó alkalom neve');
  ok(!pk.raw.includes('ash.titkos') && by(pk, 'Ash').hasEmail === true && 'playerId' in by(pk, 'Ash'), '1. szint: e-mail nélkül; Pokémonnál Player ID mező');
  ok((await list(tok.pk, 'Magic: The Gathering')).category === 'Pokémon TCG', 'nem kezelt játék listáját nem kapja meg');
  const l2 = await list(tok.l2);
  ok(by(l2, 'Ash').email === 'ash.titkos@pelda.hu', '2. szint: az e-mail is látszik');
  const rb = await list(tok.rb);
  ok(rb.category === 'Riftbound' && rb.players.length === 2 && by(rb, 'Garen#EUNE')?.events === 1 && by(rb, 'Jinx#HUN')?.events === 2, `Riftbound: csak az idézőnév, a külső jelentkezőkkel együtt (${rb.players.map(p => `${p.summoner} ${p.events}`).join(', ')})`);
  ok(!rb.raw.includes('Szabó Lili') && !rb.raw.includes('jinx@pelda.hu'), 'Riftboundnál nincs név és e-mail');

  // újabb betöltés nem duplikál; új jelentkezés bekerül
  ok((await list(tok.pk)).players.length === 3, 'újratöltéskor nincs duplikáció');
  await db.collection('registrations').insertOne(reg(1, { username: 'Gary', name: 'Oak Gábor', email: 'gary@pelda.hu' }, new Date().toISOString()));
  ok((await list(tok.pk)).players.length === 4, 'az új jelentkező a következő betöltéskor bekerül');

  // szerkesztés a felületen: Player ID
  const p = await page(b, tok.pk);
  p.on('console', m => { if (m.type() === 'error') p.errs.push(`console: ${m.text().slice(0, 300)}`); });
  await p.goto(`${BASE}/admin`, { waitUntil: 'networkidle2', timeout: 240000 });
  await p.waitForSelector('nav[aria-label="Gyors gombok"]', { timeout: 60000 });
  ok(await p.$eval('nav[aria-label="Gyors gombok"]', n => [...n.querySelectorAll('a')].some(a => a.getAttribute('href') === '/admin/jatekosok' && /Játékosok/.test(a.textContent))), 'az admin kezdőlapon Játékosok csempe');
  await p.screenshot({ path: `${SHOTS}jatekosok-csempe.jpg`, quality: 60, clip: { x: 0, y: 0, width: 1280, height: 320 } });
  await p.goto(`${BASE}/admin/jatekosok`, { waitUntil: 'networkidle2' });
  await p.waitForSelector('[data-jatekos-tabla] tbody tr', { timeout: 60000 });
  ok(await p.evaluate(() => ![...document.querySelectorAll('th')].some(t => t.textContent === 'E-mail') && [...document.querySelectorAll('th')].some(t => t.textContent === 'Player ID')), 'táblázat: Player ID oszlop, e-mail oszlop nincs (1. szint)');
  await p.screenshot({ path: `${SHOTS}jatekosok-gep.jpg`, quality: 60 });
  await p.evaluate(() => [...document.querySelectorAll('[data-jatekos-tabla] tbody tr')].find(tr => tr.textContent.includes('Ash')).querySelector('[data-jatekos-szerk]').click());
  await p.waitForSelector('[data-jatekos-urlap] #playerId');
  await p.type('[data-jatekos-urlap] #playerId', 'abc');
  await p.evaluate(() => [...document.querySelectorAll('.ant-modal-footer button')].find(x => x.textContent.includes('Mentés')).click());
  await wait(600);
  ok(/csak számjegy lehet/.test(await p.$eval('.ant-modal', m => m.innerText)), 'hibás Player ID: hiba a mezőnél');
  await p.click('[data-jatekos-urlap] #playerId', { clickCount: 3 });
  await p.type('[data-jatekos-urlap] #playerId', '1234 5678');
  await wait(500);
  ok(!/csak számjegy lehet/.test(await p.$eval('.ant-modal', m => m.innerText)), 'javításkor a hibaüzenet eltűnik');
  await p.screenshot({ path: `${SHOTS}jatekosok-szerkesztes.jpg`, quality: 60 });
  await p.evaluate(() => [...document.querySelectorAll('.ant-modal-footer button')].find(x => x.textContent.includes('Mentés')).click());
  await p.waitForFunction(() => /Elmentve/.test(document.body.innerText), { timeout: 10000 }).catch(() => {});
  const ash = await db.collection('players').findOne({ category: 'Pokémon TCG', username: 'Ash' });
  ok(ash.playerId === '12345678' && ash.email === 'ash.titkos@pelda.hu' && ash.updatedBy === 'Pokis', 'Player ID mentve, az e-mail (1. szinten nem látta) megmaradt');

  // kézi felvétel: azonos név tiltva, új mehet; törlés
  const dup = await api('/api/players', tok.pk, { actionType: 'SAVE', payload: { category: 'Pokémon TCG', username: 'brock' } });
  ok(dup.status === 400 && /Már van ilyen/.test(dup.text), 'azonos nevű játékos nem vehető fel kétszer');
  ok((await api('/api/players', tok.pk, { actionType: 'SAVE', payload: { category: 'Pokémon TCG', username: 'Erika', playerId: '777' } })).status === 200, 'kézi felvétel');
  ok((await api('/api/players', tok.pk, { actionType: 'SAVE', payload: { category: 'Magic: The Gathering', username: 'X' } })).status === 403, 'nem kezelt játékba nem vehet fel');
  const erika = await db.collection('players').findOne({ username: 'Erika' });
  ok(erika?.source === 'manual' && (await api('/api/players', tok.rb, { actionType: 'DELETE', payload: { id: String(erika._id) } })).status === 403, 'más játék szervezője nem törölheti');
  ok((await api('/api/players', tok.pk, { actionType: 'DELETE', payload: { id: String(erika._id) } })).status === 200 && !(await db.collection('players').findOne({ _id: erika._id })), 'törlés');

  // telefon: kártyák
  const ph = await page(b, tok.rb, 402, 874);
  await ph.goto(`${BASE}/admin/jatekosok`, { waitUntil: 'networkidle2' });
  await ph.waitForSelector('[data-jatekos]', { timeout: 60000 });
  ok((await ph.$$('[data-jatekos]')).length === 2 && (await ph.evaluate(() => document.documentElement.scrollWidth)) === 402, 'telefonon kártyák, nincs vízszintes görgetés');
  await ph.screenshot({ path: `${SHOTS}jatekosok-telefon.jpg`, quality: 60 });
  console.log('  böngészőhibák:', [...p.errs, ...ph.errs].join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
