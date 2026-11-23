// Riftbound liga: egyszerű pontozás. A játékosok a bázisból (eseményekről) bekerülnek, a szervező játékosonként az
// összpontot írja át (pl. 13 → 15); publikálás után a nyilvános ranglista „+2 pont”-ot és a helyezésváltozást mutatja.
// A ranglistán csak az van, akinek legalább 1 pontja van. A többi játék ligája marad alkalmanként.
import { openDb, token, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';

const { client, db } = await openDb();
const owner = (await db.collection('users').insertOne({ username: 'Tulaj', email: 'o@x.hu', password: 'x', role: 'owner', lastSeenChangelog: '9999' })).insertedId;
const tok = await token(owner, 'Tulaj', 'owner');
const post = async (actionType, payload) => { const r = await fetch(`${BASE}/api/admin-leagues`, { method: 'POST', headers: { Cookie: `tavern_session=${tok}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType, payload }) }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };

const b = await browser();
try {
  const rb = await post('CREATE_LEAGUE', { category: 'Riftbound', name: 'Riftbound liga', autoStores: [] });
  const op = await post('CREATE_LEAGUE', { category: 'One Piece Card Game', name: 'One Piece liga', autoStores: [] });
  const ids = (await db.collection('league_players').insertMany(['DannyKen#1337', 'Jinx#HUN', 'Garen#EUNE'].map(r => ({ leagueId: rb.id, nickname: r.split('#')[0], riotId: r, source: 'rgn', eventIds: [], createdAt: new Date() })))).insertedIds;
  const pid = (i) => String(ids[i]);

  // első kör: Danny 13, Jinx 5, Garen 0 → publikálás
  ok((await post('SET_POINTS', { leagueId: rb.id, points: { [pid(0)]: 13, [pid(1)]: 5 } })).status === 200, 'Riftbound: az összpont közvetlenül beírható');
  ok((await post('SET_POINTS', { leagueId: op.id, points: { x: 1 } })).status === 400, 'más játéknál ez nem megy (ott alkalmanként)');
  ok((await post('SET_POINTS', { leagueId: rb.id, points: { [pid(0)]: -3 } })).status === 400, 'negatív pont nem írható be');
  await post('PUBLISH', { leagueId: rb.id });
  let html = await (await fetch(`${BASE}/liga/riftbound`)).text();
  ok(/DannyKen/.test(html) && /Jinx/.test(html) && !/Garen/.test(html), 'a ranglistán csak az van, akinek legalább 1 pontja van');

  // az adminban: Pontok fül (nincs Alkalmak), Danny 13 → 15, Jinx 5 → 20, Garen 0 → 3
  const p = await page(b, tok);
  await p.goto(`${BASE}/admin/liga`, { waitUntil: 'networkidle2', timeout: 240000 });
  await p.waitForFunction(() => document.body.innerText.includes('Játék'), { timeout: 60000 });
  await p.evaluate(() => [...document.querySelectorAll('.ant-segmented-item')].find(x => x.textContent.trim() === 'Riftbound')?.click());
  await p.waitForSelector('[data-rb-pontok]', { timeout: 15000 });
  const tabs = await p.$$eval('.ant-tabs-tab', els => els.map(e => e.textContent));
  ok(tabs.some(t => /^Pontok/.test(t)) && !tabs.some(t => /^Alkalmak/.test(t)), `Riftboundnál „Pontok” fül van, „Alkalmak” nincs (${tabs.join(', ')})`);
  const set = async (riot, n) => {
    const input = await p.$(`[data-rb-sor="${riot}"] input`);
    await input.click({ clickCount: 3 });
    await input.type(String(n));
  };
  const rowText = (riot) => p.$eval(`[data-rb-sor="${riot}"]`, el => el.innerText);
  ok(/13/.test(await p.$eval('[data-rb-sor="DannyKen#1337"] input', i => i.value)), 'a listában ott a játékos a mostani pontjával (DannyKen#1337 13)');
  ok(/nincs a ranglistán/.test(await rowText('Garen#EUNE')), 'a 0 pontos játékos is a listában van (pontot kaphat), de jelezve, hogy nincs a ranglistán');
  await set('DannyKen#1337', 15);
  await set('Jinx#HUN', 20);
  await set('Garen#EUNE', 3);
  await wait(200);
  ok(/\+2 pont/.test(await rowText('DannyKen#1337')), 'átírás közben látszik: +2 pont a publikálás óta');
  await p.screenshot({ path: `${SHOTS}liga-riftbound-pontok.jpg`, quality: 60 });
  await p.click('[data-pontok-mentes]');
  await p.waitForFunction(() => /pontja elmentve/.test(document.body.innerText), { timeout: 10000 }).catch(() => {});
  const saved = await db.collection('league_players').find({ leagueId: rb.id }).toArray();
  ok(saved.find(x => x.riotId === 'DannyKen#1337').points === 15 && saved.find(x => x.riotId === 'Jinx#HUN').points === 20 && saved.find(x => x.riotId === 'Garen#EUNE').points === 3, 'mentve: 15, 20, 3');
  ok(!!(await db.collection('audit_logs').findOne({ action: 'LIGA PONTOK', details: /DannyKen#1337: 13 → 15/ })), 'naplózva: DannyKen#1337: 13 → 15');

  // publikálás után a nyilvános oldalon: +2 pont, és a helyezésváltozás
  await post('PUBLISH', { leagueId: rb.id });
  const pub = await page(b, null, 402, 874);
  await pub.goto(`${BASE}/liga/riftbound`, { waitUntil: 'networkidle2' });
  const txt = await pub.evaluate(() => document.body.innerText);
  ok(/DannyKen[\s\S]*\+2 pont/.test(txt), 'a nyilvános ranglistán: DannyKen +2 pont');
  ok(/▼1/.test(txt) && /▲1/.test(txt), 'a helyezésváltozás is látszik (Jinx előrelépett ▲1, Danny visszaesett ▼1)');
  ok(/Garen[\s\S]*ÚJ|ÚJ[\s\S]*Garen/.test(txt), 'aki most került fel, az „ÚJ”');
  await pub.screenshot({ path: `${SHOTS}liga-riftbound-nyilvanos.jpg`, quality: 60 });

  // a One Piece liga változatlan: Alkalmak fül
  await p.evaluate(() => [...document.querySelectorAll('.ant-segmented-item')].find(x => x.textContent.trim() === 'One Piece Card Game')?.click());
  await wait(600);
  ok(await p.evaluate(() => [...document.querySelectorAll('.ant-tabs-tab')].some(e => /^Alkalmak/.test(e.textContent)) && !document.querySelector('[data-rb-pontok]')), 'a többi játék ligája marad alkalmanként');
  console.log('  böngészőhibák:', [...p.errs, ...pub.errs].join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
