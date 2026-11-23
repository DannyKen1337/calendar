// Ligák: egy játékhoz több liga is futhat egyszerre (pl. boltonként), mindegyik saját linkkel; a régi, slug nélküli
// liga régi linkje is működik. A publikált, de még eredmény nélküli liga a weboldalon „Hamarosan indul” kártyát kap.
import { openDb, token, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';

const { client, db } = await openDb();
const owner = (await db.collection('users').insertOne({ username: 'Tulaj', email: 'o@x.hu', password: 'x', role: 'owner', lastSeenChangelog: '9999' })).insertedId;
const tok = await token(owner, 'Tulaj', 'owner');
const post = async (actionType, payload) => { const r = await fetch(`${BASE}/api/admin-leagues`, { method: 'POST', headers: { Cookie: `tavern_session=${tok}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType, payload }) }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };
// régi liga (még slug nélkül, a játék nevével elérhető), publikált ranglistával
await db.collection('leagues').insertOne({ category: 'Pokémon TCG', name: 'Pokémon liga', autoStores: ['debrecen'], published: { at: new Date(), rows: [{ playerId: 'p1', nickname: 'K. Levente', rank: 1, points: 12, delta: 0 }] }, createdAt: new Date() });

const b = await browser();
try {
  // két One Piece liga, két boltban
  const deb = await post('CREATE_LEAGUE', { category: 'One Piece Card Game', name: 'One Piece liga – Debrecen', autoStores: ['debrecen'] });
  const mis = await post('CREATE_LEAGUE', { category: 'One Piece Card Game', name: 'One Piece liga – Miskolc', autoStores: ['miskolc'] });
  ok(deb.status === 200 && mis.status === 200, `egy játékhoz két liga is létrehozható (${deb.status}, ${mis.status} ${mis.error || ''})`);
  const dup = await post('CREATE_LEAGUE', { category: 'One Piece Card Game', name: 'one piece liga – miskolc', autoStores: [] });
  ok(dup.status === 400 && dup.field === 'name', 'azonos nevű liga nem jöhet létre kétszer ugyanannál a játéknál');
  const list = await db.collection('leagues').find({ category: 'One Piece Card Game' }).sort({ createdAt: 1 }).toArray();
  ok(list.map(l => l.slug).join() === 'one-piece-card-game,one-piece-liga-miskolc', `saját link ligánként (${list.map(l => l.slug).join(', ')})`);

  // a miskolci publikálva, még eredmény nélkül
  ok((await post('PUBLISH', { leagueId: mis.id })).status === 200, 'eredmény nélkül is publikálható');
  let r = await fetch(`${BASE}/liga/one-piece-liga-miskolc`);
  const html = await r.text();
  ok(r.status === 200 && /One Piece liga – Miskolc/.test(html) && /Tavern Miskolc/.test(html) && /Hamarosan indul/.test(html), 'a liga saját oldala: név, bolt, „Hamarosan indul”');
  ok((await fetch(`${BASE}/liga/one-piece-card-game`)).status === 404, 'a még nem publikált debreceni liga oldala nem érhető el');
  r = await fetch(`${BASE}/liga/pokemon-tcg`);
  ok(r.status === 200 && /K\. Levente/.test(await r.text()), 'a régi liga régi linkje (/liga/pokemon-tcg) továbbra is működik');

  // weboldal: a publikált ligák kártyái; eredmény nélkül „Hamarosan indul”
  const p = await page(b, null);
  await p.goto(`${BASE}/weblapteszt`, { waitUntil: 'networkidle2', timeout: 240000 });
  const cards = await p.$$eval('[data-ligak] [data-liga]', els => els.map(e => ({ text: e.innerText, soon: !!e.querySelector('[data-hamarosan]'), href: e.querySelector('a')?.getAttribute('href') })));
  ok(cards.length === 2, `két publikált liga a weboldalon (${cards.length})`);
  const soon = cards.find(c => /Miskolc/.test(c.text));
  ok(soon?.soon && /HAMAROSAN INDUL/i.test(soon.text) && /Tavern Miskolc/.test(soon.text) && soon.href === '/liga/one-piece-liga-miskolc', 'eredmény nélküli liga: „Hamarosan indul” kártya a bolttal és a saját linkkel');
  ok(cards.some(c => /Pokémon liga/i.test(c.text) && !c.soon && /K\. Levente/.test(c.text) && /Tavern Debrecen/i.test(c.text)), `a ranglistás liga kártyáján a bolt is (${cards.map(c => c.text.replace(/\n/g, ' ')).join(' | ')})`);
  await p.$eval('[data-ligak]', el => el.scrollIntoView({ block: 'center' }));
  await wait(800);
  await p.screenshot({ path: `${SHOTS}ligak-hamarosan.jpg`, quality: 60 });

  // admin: a játékon belül ligaválasztó és „Új liga”
  const a = await page(b, tok);
  await a.goto(`${BASE}/admin/liga`, { waitUntil: 'networkidle2', timeout: 240000 });
  await a.waitForFunction(() => document.body.innerText.includes('Játék'), { timeout: 60000 });
  await a.evaluate(() => [...document.querySelectorAll('.ant-segmented-item')].find(x => x.textContent.includes('One Piece Card Game'))?.click());
  await a.waitForSelector('[data-liga-valaszto]', { timeout: 15000 });
  const picker = await a.$eval('[data-liga-valaszto]', el => el.innerText);
  ok(/One Piece liga – Debrecen/.test(picker) && /One Piece liga – Miskolc/.test(picker) && /Új liga/.test(picker) && /Tavern Miskolc/.test(picker), 'az adminban a játék ligái között lehet választani, és van „Új liga”');
  await a.evaluate(() => [...document.querySelectorAll('[data-liga-valaszto] .ant-segmented-item')].find(x => x.textContent.includes('Miskolc'))?.click());
  await wait(400);
  ok(/One Piece liga – Miskolc/.test(await a.$eval('h3', h => h.textContent)), 'a kiválasztott liga nyílik meg');
  await a.screenshot({ path: `${SHOTS}ligak-admin-valaszto.jpg`, quality: 60 });
  await a.evaluate(() => [...document.querySelectorAll('[data-liga-valaszto] .ant-segmented-item')].find(x => x.textContent.includes('Új liga'))?.click());
  await a.waitForSelector('[data-uj-liga]', { timeout: 10000 });
  ok(/több liga is futhat/.test(await a.evaluate(() => document.body.innerText)), 'Új liga: magyarázat, hogy több liga is futhat');
  console.log('  böngészőhibák:', [...p.errs, ...a.errs].join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
