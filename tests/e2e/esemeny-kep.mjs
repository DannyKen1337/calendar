// Az esemény képe: ha a saját (külső) képe nem tölt be, az eseményoldalon és a jelentkezési oldalon a játék helyi logója
// látszik helyette (a weboldal ablakában is); működő saját képnél az marad.
import { openDb, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';

const { client, db } = await openDb();
const pad = (n) => String(n).padStart(2, '0');
const d = new Date(Date.now() + 3 * 86400000);
const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ids = (await db.collection('tournaments').insertMany([
  { name: 'Tavern Pokemon Klubnap', date: `${day}T17:00`, category: 'Pokémon TCG', store: 'debrecen', max_players: 16, current_players: 0, is_open: true, imageUrl: `${BASE}/nincs-ilyen-kep.png`, createdAt: new Date() },
  { name: 'Riftbound saját képpel', date: `${day}T18:00`, category: 'Riftbound', store: 'debrecen', max_players: 16, current_players: 0, is_open: true, imageUrl: '/jatekok/magic.png', createdAt: new Date() },
])).insertedIds;

const b = await browser();
try {
  const p = await page(b, null);
  const imgOf = async (url) => {
    await p.goto(`${BASE}${url}`, { waitUntil: 'networkidle2', timeout: 240000 });
    await wait(400);
    return p.$$eval('img', els => els.filter(i => /jatekok|nincs-ilyen/.test(i.getAttribute('src') || '')).map(i => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0 })));
  };
  let imgs = await imgOf(`/esemeny/${ids[0]}`);
  ok(imgs.length > 0 && imgs.every(i => i.src === '/jatekok/pokemon.png' && i.ok), `eseményoldal: a nem betöltődő saját kép helyett a Pokémon logó (${JSON.stringify(imgs)})`);
  await p.screenshot({ path: `${SHOTS}esemeny-kep-tartalek.jpg`, quality: 60 });
  imgs = await imgOf(`/jelentkezes/${ids[0]}`);
  ok(imgs.length > 0 && imgs.every(i => i.src === '/jatekok/pokemon.png' && i.ok), `jelentkezési oldal: ugyanígy (${JSON.stringify(imgs)})`);
  imgs = await imgOf(`/esemeny/${ids[1]}?embed=1`);
  ok(imgs.some(i => i.src === '/jatekok/magic.png' && i.ok), 'a működő saját kép marad (a weboldal ablakában is)');
  console.log('  böngészőhibák:', p.errs.join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
