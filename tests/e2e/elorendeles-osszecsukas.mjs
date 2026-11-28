// Admin, Előrendelések: a nyitott előrendelések kártyája alapból nyitva (részletek, gombok), a lezártaké összecsukva
// (egy sor: név, Lezárva, bolt, jelentkezők és darab). Ha egy játékban csak lezárt előrendelés van, a játék szakasza is
// összecsukva (csak a fejléc), a „Lezárt” szűrőnél nyitva. Kattintásra kinyílik, „Összecsukás”-ra újra összecsukódik; az épp
// lezárt termék kártyája nyitva marad, újratöltés után már összecsukva jön. Gépen és telefonon.
import { openDb, token, browser, page, ok, summary, wait, BASE, SHOTS } from './lib.mjs';

const { client, db } = await openDb();
const owner = (await db.collection('users').insertOne({ username: 'Tulaj', email: 'o@x.hu', password: 'x', role: 'owner', lastSeenChangelog: '9999' })).insertedId;
const tok = await token(owner, 'Tulaj', 'owner');
const now = new Date();
const product = async (doc) => String((await db.collection('preorder_products').insertOne({ category: 'Pokémon TCG', perPersonLimit: 0, createdAt: now, ...doc })).insertedId);
const open1 = await product({ name: 'Nyitott ETB', isOpen: true });
const open2 = await product({ name: 'Másik nyitott doboz', isOpen: true });
const closed1 = await product({ name: 'Régi lezárt doboz', isOpen: false, stores: ['miskolc'] });
// egy játék, amelyben csak lezárt előrendelés van: a játék szakasza is összecsukva
const opClosed = await product({ name: 'Lezárt OP display', category: 'One Piece Card Game', isOpen: false });
await db.collection('preorders').insertMany([
  { productId: closed1, name: 'Ash', email: 'a@x.hu', quantity: 2, date: now },
  { productId: closed1, name: 'Misty', email: 'm@x.hu', quantity: 1, date: now, handedOverAt: now },
  { productId: open1, name: 'Brock', email: 'b@x.hu', quantity: 1, date: now },
]);

const state = (p) => p.$$eval('[data-termek-kartya]', els => Object.fromEntries(els.map(el => [el.dataset.termekKartya, { collapsed: el.hasAttribute('data-osszecsukva'), text: el.innerText.replace(/\s+/g, ' ') }])));
const b = await browser();
try {
  for (const [w, h, name] of [[1280, 900, 'gép'], [402, 874, 'telefon']]) {
    const p = await page(b, tok, w, h);
    await p.goto(`${BASE}/admin/elorendeles`, { waitUntil: 'networkidle2', timeout: 240000 });
    await p.waitForSelector('[data-termek-kartya]', { timeout: 60000 });
    let s = await state(p);
    ok(!s[open1]?.collapsed && !s[open2]?.collapsed && /Szerkesztés/.test(s[open1]?.text), `${name}: a nyitott előrendelések kártyája alapból nyitva`);
    ok(s[closed1]?.collapsed && !/Szerkesztés|Újranyitás/.test(s[closed1]?.text), `${name}: a lezárt alapból összecsukva (${s[closed1]?.text})`);
    ok(/Régi lezárt doboz/.test(s[closed1].text) && /Lezárva/.test(s[closed1].text) && /Tavern Miskolc|Miskolc/.test(s[closed1].text) && /2 jelentkező · 3 db · 1 \/ 2 átadva/.test(s[closed1].text), `${name}: az összecsukott sorban a név, az állapot, a bolt és az összesítő`);
    const op = () => p.$eval('[data-jatek-szakasz="One Piece Card Game"]', el => ({ collapsed: el.hasAttribute('data-osszecsukva'), cards: el.querySelectorAll('[data-termek-kartya]').length, text: el.innerText.replace(/s+/g, ' ') }));
    let g = await op();
    ok(g.collapsed && g.cards === 0 && /1 lezárt termék/.test(g.text), `${name}: a csak lezárt előrendelésű játék összecsukva (${g.text.slice(0, 80)})`);
    ok(!(await p.$eval('[data-jatek-szakasz="Pokémon TCG"]', el => el.hasAttribute('data-osszecsukva'))), `${name}: a nyitott előrendelésű játék nyitva`);
    await p.click('[data-jatek-szakasz="One Piece Card Game"] h5 button');
    await wait(300);
    g = await op();
    ok(!g.collapsed && g.cards === 1, `${name}: a fejlécre kattintva megjelenik a lezárt termék`);
    await p.click('[data-jatek-szakasz="One Piece Card Game"] [data-jatek-osszecsukas]');
    await wait(300);
    ok((await op()).collapsed, `${name}: „Összecsukás”-ra a játék újra összecsukódik`);
    if (name === 'telefon') ok(await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'telefonon nincs oldalirányú görgetés');
    await p.click(`[data-termek-kartya="${closed1}"] button`);
    await wait(300);
    s = await state(p);
    ok(!s[closed1].collapsed && /Újranyitás/.test(s[closed1].text) && /Összecsukás/.test(s[closed1].text), `${name}: kattintásra kinyílik, a gombokkal`);
    await p.click(`[data-termek-kartya="${closed1}"] [data-osszecsukas]`);
    await wait(300);
    ok((await state(p))[closed1].collapsed, `${name}: „Összecsukás”-ra újra összecsukódik`);
    await p.screenshot({ path: `${SHOTS}elorendeles-osszecsukas-${name === 'gép' ? 'gep' : 'telefon'}.jpg`, quality: 60 });
    console.log(`  böngészőhibák (${name}):`, p.errs.join(' | ') || 'nincs');
    await p.close();
  }

  // a „Lezárt” szűrőnél a csak lezárt játék is nyitva (azokat keresi)
  {
    const p = await page(b, tok, 1280, 900);
    await p.goto(`${BASE}/admin/elorendeles`, { waitUntil: 'networkidle2', timeout: 240000 });
    await p.waitForSelector('[data-jatek-szakasz]', { timeout: 60000 });
    await p.evaluate(() => [...document.querySelectorAll('.ant-segmented-item')].find(x => x.textContent.trim() === 'Lezárt').click());
    await wait(400);
    ok(await p.$eval('[data-jatek-szakasz="One Piece Card Game"]', el => !el.hasAttribute('data-osszecsukva') && el.querySelectorAll('[data-termek-kartya]').length === 1), 'a „Lezárt” szűrőnél a csak lezárt játék is nyitva');
    await p.close();
  }

  // lezárás után a kártya nyitva marad, újratöltéskor összecsukva jön
  const p = await page(b, tok, 1280, 900);
  await p.goto(`${BASE}/admin/elorendeles`, { waitUntil: 'networkidle2', timeout: 240000 });
  await p.waitForSelector(`[data-termek-kartya="${open2}"]`, { timeout: 60000 });
  await p.evaluate((id) => [...document.querySelectorAll(`[data-termek-kartya="${id}"] button`)].find(x => x.textContent.includes('Lezárás')).click(), open2);
  await wait(400);
  await p.evaluate(() => [...document.querySelectorAll('.ant-popconfirm button, .ant-popover button')].find(x => x.textContent.includes('Lezárás'))?.click());
  await wait(1500);
  let s = await state(p);
  ok((await db.collection('preorder_products').findOne({ name: 'Másik nyitott doboz' })).isOpen === false && !s[open2].collapsed && /Lezárva/.test(s[open2].text), 'az épp lezárt kártya nyitva marad');
  await p.reload({ waitUntil: 'networkidle2' });
  await p.waitForSelector(`[data-termek-kartya="${open2}"]`, { timeout: 60000 });
  s = await state(p);
  ok(s[open2].collapsed, 'újratöltés után már összecsukva');
} finally {
  await b.close(); await client.close(); summary();
}
