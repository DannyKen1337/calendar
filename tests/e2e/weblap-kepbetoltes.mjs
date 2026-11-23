// Galéria képei újrapróbálással (SafeImg): az ImgBB néha lóg vagy megszakad. Ha a bélyegkép hibát ad, a teljes méretre vált;
// ha a kérés 8 mp-ig sem válaszol, szintén; ha egyik sem jön meg, helyőrző látszik. (A lógást a teszt egy soha nem
// válaszoló kéréssel szimulálja.)
import { openDb, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';

const { client, db } = await openDb();
const pic = (id, src, thumb) => ({ id, picture: { src, ...(thumb && { thumb }), alt: '', position: '50% 50%' }, caption: '' });
await db.collection('website_content').insertOne({ _id: 'site', albums: { title: 'Galéria', lead: '', albums: [
  { id: 'pw', title: 'Pokeween 2026', date: '2026-10-31', game: 'Pokémon TCG', store: 'debrecen', pictures: [
    pic('a', '/photos/bolt-asztalok.png', '/photos/nincs-ilyen-1.png'), // a bélyegkép 404 → a teljes méret
    pic('b', '/photos/klub-asztal.png', '/photos/verseny.png'),         // a bélyegkép lóg → 8 mp után a teljes méret
    pic('c', '/photos/nincs-ilyen-2.png', '/photos/nincs-ilyen-3.png'), // egyik sem jön → helyőrző
  ] },
] } });

const b = await browser();
try {
  const p = await page(b, null);
  await p.setRequestInterception(true);
  p.on('request', (req) => { if (/\/photos\/verseny\.png$/.test(req.url())) return; /* soha nem válaszol */ req.continue().catch(() => {}); });
  await p.goto(`${BASE}/weblapteszt/galeria/pokeween-2026`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await p.waitForSelector('[data-kep]', { timeout: 60000 });
  await wait(2500);
  const state = () => p.$$eval('[data-kep]', els => els.map(e => { const img = e.querySelector('img'); return img ? { src: img.getAttribute('src'), ok: img.complete && img.naturalWidth > 0 } : { fail: !!e.querySelector('[data-kep-hiba]') }; }));
  let s = await state();
  ok(/bolt-asztalok\.png$/.test(s[0].src || '') && s[0].ok, `a hibás bélyegkép helyett a teljes méretű kép (${s[0].src})`);
  ok(/verseny\.png$/.test(s[1].src || '') && !s[1].ok, 'a lógó kép eleinte még tölt');
  ok(s[2].fail, 'ha egyik változat sem jön meg: helyőrző');
  await wait(7500);
  s = await state();
  ok(/klub-asztal\.png$/.test(s[1].src || '') && s[1].ok, `8 mp után a lógó helyett a másik változat betöltött (${s[1].src})`);
  await p.screenshot({ path: `${SHOTS}galeria-kepbetoltes.jpg`, quality: 60, fullPage: true });
  ok(await p.$eval('[data-album-hero] img', i => i.complete && i.naturalWidth > 0), 'az album fejlécképe is betöltött (tartalékkal)');
  console.log('  böngészőhibák:', p.errs.join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
