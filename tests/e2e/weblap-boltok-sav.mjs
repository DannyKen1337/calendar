// Weboldal, első képernyő: mindhárom bolt egyforma helyen a cégér és az előrendelések alatt (a felhasználó kérése: a
// főoldal mindhárom bolt landing oldala). Boltonként: név, nyitva van-e, a következő esemény; kattintásra a bolt
// nyitvatartásához / címéhez visz. Gépen (1440×900) és telefonon (402×874) is kifér, és nem lóg ki semmi.
import { openDb, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';

const { client, db } = await openDb();
const pad = (n) => String(n).padStart(2, '0');
const day = (o) => { const d = new Date(); d.setDate(d.getDate() + o); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
await db.collection('tournaments').insertMany([
  { name: 'Pokémon klubnap', date: `${day(0)}T23:30`, category: 'Pokémon TCG', store: 'debrecen', max_players: 16, is_open: true },
  { name: 'Standard verseny', date: `${day(1)}T11:00`, category: 'Magic: The Gathering', store: 'jatekceh', max_players: 16, is_open: true },
  { name: 'Riftbound klubnap', date: `${day(2)}T16:00`, category: 'Riftbound', store: 'miskolc', max_players: 16, is_open: true },
  { name: 'Későbbi miskolci', date: `${day(4)}T16:00`, category: 'Riftbound', store: 'miskolc', max_players: 16, is_open: true },
]);

const read = (p) => p.$$eval('[data-boltok-sav] [data-bolt-csempe]', els => els.map(a => ({ id: a.dataset.boltCsempe, href: a.getAttribute('href'), text: a.innerText.replace(/\s+/g, ' ').trim(), r: a.getBoundingClientRect().toJSON() })));
const b = await browser();
try {
  for (const [w, h, name] of [[1440, 900, 'gep'], [402, 874, 'telefon']]) {
    const p = await page(b, null, w, h);
    await p.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 240000 });
    await wait(1500);
    const tiles = await read(p);
    ok(tiles.map(t => t.id).join(',') === 'debrecen,jatekceh,miskolc', `${name}: mindhárom bolt ott van (${tiles.map(t => t.id).join(',')})`);
    ok(/Tavern Debrecen/.test(tiles[0]?.text) && /JátékCéh/.test(tiles[1]?.text) && /Tavern Miskolc/.test(tiles[2]?.text), `${name}: a boltok neve`);
    ok(/Ma 23:30 Pokémon klubnap/.test(tiles[0]?.text) && /Holnap 11:00 Standard verseny/.test(tiles[1]?.text) && /Riftbound klubnap/.test(tiles[2]?.text) && !/Későbbi/.test(tiles[2]?.text), `${name}: boltonként a következő esemény (${tiles.map(t => t.text).join(' | ')})`);
    ok(tiles.every(t => /Nyitva|Zárva|Ma zárva|Nyitvatartás/i.test(t.text)), `${name}: nyitva van-e`);
    ok(await p.evaluate(() => [...document.querySelectorAll('[data-bolt-csempe]')].every(a => document.getElementById(a.getAttribute('href').slice(1)))), `${name}: a csempe a bolt nyitvatartásához visz`);
    // kifér: a csempék és „A heti program” gomb az első képernyőn, a lap nem görget oldalra
    const fold = await p.evaluate(() => { const btn = document.querySelector('[data-boltok-sav] ~ div a[href="#program"]'); return { btn: btn ? btn.getBoundingClientRect().bottom : 1e9, vh: innerHeight, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
    if (name === 'gep') ok(tiles.every(t => t.r.bottom <= fold.vh) && fold.btn <= fold.vh, `gépen minden kifér az első képernyőre (csempék alja ${Math.round(Math.max(...tiles.map(t => t.r.bottom)))}, gomb ${Math.round(fold.btn)}, képernyő ${fold.vh})`);
    else ok(tiles.every(t => t.r.height >= 44 && t.r.right <= w), `telefonon a csempék legalább 44 px magasak és nem lógnak ki`);
    ok(fold.sw <= fold.cw, `${name}: nincs oldalirányú görgetés`);
    await p.screenshot({ path: `${SHOTS}fooldal-boltok-sav-${name}.jpg`, quality: 60 });
    // kattintásra a boltok részhez görget
    await p.click('[data-bolt-csempe="miskolc"]');
    await wait(1200);
    const at = await p.evaluate(() => { const r = document.getElementById('bolt-miskolc').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; });
    ok(at, `${name}: kattintásra a miskolci bolt nyitvatartása látszik`);
    console.log(`  böngészőhibák (${name}):`, p.errs.join(' | ') || 'nincs');
  }
} finally {
  await b.close(); await client.close(); summary();
}
