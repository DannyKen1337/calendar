// Weboldal, mozgások: játékszűrő (FLIP), telítettség-sáv (feltöltődik, amikor látszik), „Most zajlik” / „Hamarosan kezdődik” (telefonon „Hamarosan”),
// a bolt „Nyitva” visszaszámlálása, ligakártya felpörgése, „Utolsó darabok” (rázkódás, készletsáv), a Galéria fotóinak
// billenése, sikeres asztalfoglalás után felbillenő „FOGLALT” tábla, albumnyitás átnövéssel (ViewTransition).
// Csökkentett mozgásnál a szűrés nem animál.
import { openDb, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';

const { client, db } = await openDb();
// budapesti idő "YYYY-MM-DDTHH:MM" alakban, percben eltolva
const bp = (offsetMin) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(Date.now() + offsetMin * 60000)).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};
await db.collection('tournaments').insertMany([
  { name: 'Pokémon klubnap', date: bp(-30), category: 'Pokémon TCG', store: 'debrecen', max_players: 16, current_players: 13, is_open: true, createdAt: new Date() },
  { name: 'Magic Szerda', date: bp(90), category: 'Magic: The Gathering', store: 'debrecen', max_players: 8, current_players: 2, is_open: true, createdAt: new Date() },
  { name: 'Fantasista Fight Night', date: bp(26 * 60), category: 'One Piece Card Game', store: 'debrecen', max_players: 16, current_players: 16, is_open: true, createdAt: new Date() },
  { name: 'Pokémon BO1 verseny', date: bp(50 * 60), category: 'Pokémon TCG', store: 'miskolc', max_players: 24, current_players: 6, is_open: true, createdAt: new Date() },
]);
await db.collection('leagues').insertOne({ category: 'Riftbound', name: 'Riftbound liga', autoStores: ['debrecen'], published: { at: new Date(), rows: [
  { playerId: 'a', nickname: 'Jinx', rank: 1, points: 20, delta: 15, rankChange: 1 },
  { playerId: 'b', nickname: 'DannyKen', rank: 2, points: 15, delta: 2, rankChange: -1 },
  { playerId: 'c', nickname: 'Garen', rank: 3, points: 9, delta: 3, isNew: true },
] }, createdAt: new Date() });
const prod = (await db.collection('preorder_products').insertOne({ name: 'Mega Evolution ETB', category: 'Pokémon TCG', price: 19990, releaseDate: 'december 5.', stock: 10, isOpen: true, createdAt: new Date() })).insertedId;
await db.collection('preorders').insertMany(Array.from({ length: 8 }, (_, i) => ({ productId: String(prod), name: `Vevő ${i}`, email: `v${i}@x.hu`, phone: '+36301234567', quantity: 1, date: new Date() })));
await db.collection('website_content').insertOne({ _id: 'site', albums: { title: 'Galéria', lead: 'Képek', albums: [
  { id: 'pokeween', title: 'Pokeween 2026', date: '2026-10-31', game: 'Pokémon TCG', store: 'debrecen', pictures: [{ id: 'p1', picture: { src: '/photos/bolt-asztalok.png', alt: '', position: '50% 50%' }, caption: '' }, { id: 'p2', picture: { src: '/photos/verseny.png', alt: '', position: '50% 50%' }, caption: '' }] },
] } });

const b = await browser();
try {
  const p = await page(b, null);
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 240000 });

  // telítettség-sáv: amíg a program nem látszik, üres; a képernyőre érve feltöltődik
  const scaleOf = (sel) => p.$eval(sel, el => { const m = getComputedStyle(el).transform; return m === 'none' ? 1 : Number(m.match(/matrix\(([^,]+)/)?.[1]); });
  const before = await scaleOf('[data-esemeny] [data-telitettseg] i');
  await p.$eval('#program', el => el.scrollIntoView({ block: 'start' }));
  await wait(1400);
  const after = await scaleOf('[data-esemeny] [data-telitettseg] i');
  ok(before < 0.05 && after > 0.7, `a telítettség-sáv a képernyőre érve töltődik fel (${before.toFixed(2)} → ${after.toFixed(2)}, 13/16)`);
  ok(await p.$$eval('[data-telitettseg]', els => els.some(e => /hely szabad|Betelt/.test(e.getAttribute('aria-label')))), 'a sáv a felolvasónak is mondja (pl. „3 hely szabad”)');

  // „Most zajlik” / „Hamarosan kezdődik” (a pontos idő a felugró címben)
  const live = await p.$$eval('[data-elo]', els => els.map(e => [e.dataset.elo, e.innerText.trim(), e.title || '']));
  ok(live.some(([k, t]) => k === 'run' && t === 'Most zajlik'), `a fél órája kezdődött esemény: „Most zajlik” (${JSON.stringify(live)})`);
  ok(live.some(([k, t, title]) => k === 'soon' && t === 'Hamarosan kezdődik' && /^1 óra (2\d|30) perc múlva$/.test(title)), 'a másfél óra múlva kezdődő: „Hamarosan kezdődik”, a felugró címben „1 óra 30 perc múlva”');
  ok(await p.$eval('[data-elo] i', i => getComputedStyle(i, '::after').animationName !== 'none'), 'lüktető pont');
  await p.screenshot({ path: `${SHOTS}mozgas-program.jpg`, quality: 60 });

  // játékszűrő: a maradók elcsúsznak, az újak beúsznak
  await p.evaluate(() => [...document.querySelectorAll('#program [role="group"] button')].find(x => x.textContent === 'Pokémon').click());
  await wait(220);
  const moving = await p.$$eval('[data-esemeny]', els => els.filter(e => e.getAnimations().length > 0).length);
  await wait(700);
  const names = await p.$$eval('[data-esemeny] b', els => els.map(e => e.textContent));
  ok(moving > 0 && names.length === 2 && names.every(n => /Pokémon/.test(n)), `szűréskor a sorok animálnak, utána csak a Pokémon események (${moving} mozgó, ${names.join(', ')})`);
  await p.evaluate(() => [...document.querySelectorAll('#program [role="group"] button')].find(x => x.textContent === 'Minden játék').click());
  await wait(900);
  ok((await p.$$('[data-esemeny]')).length === 4 && (await p.$$eval('[data-telitettseg] i', els => els.every(i => getComputedStyle(i).transform !== 'matrix(0, 0, 0, 1, 0, 0)'))), 'visszaváltva minden esemény, a sávok teliek (az újra megjelenő boltnál is)');

  // a bolt „Nyitva”: lüktető pont és a zárásig hátralévő idő
  const status = await p.$$eval('#boltok [data-nyitvatartas] > span:first-child', els => els.map(e => e.textContent));
  const openOne = status.find(t => /Nyitva/.test(t));
  ok(!openOne || /még \d+ (óra|perc)/.test(openOne), `nyitott boltnál a zárásig hátralévő idő (${openOne || 'most egy bolt sincs nyitva'})`);

  // ligakártya: a pontok felpörögnek, ▲ / ÚJ / +pont
  await p.$eval('#liga', el => el.scrollIntoView({ block: 'center' }));
  await wait(250);
  const mid = await p.$eval('[data-liga] [data-pont]', el => Number(el.textContent));
  await wait(1700);
  const fin = await p.$eval('[data-liga]', el => ({ first: Number(el.querySelector('[data-pont]').textContent), text: el.innerText }));
  ok(mid < 20 && fin.first === 20, `a pont felpörög (${mid} → ${fin.first})`);
  ok(/▲1/.test(fin.text) && /▼1/.test(fin.text) && /ÚJ/.test(fin.text) && /\+15/.test(fin.text), 'helyezésváltozás (▲1, ▼1, ÚJ) és +pont a kártyán');
  await p.screenshot({ path: `${SHOTS}mozgas-liga.jpg`, quality: 60 });

  // „Utolsó darabok”: rázkódás és fogyó készletsáv (10-ből 2 maradt)
  await p.$eval('[data-elorendeles-sav]', el => el.scrollIntoView({ block: 'center' }));
  const pre = await p.$eval('[data-elorendeles-sav]', el => ({ fut: el.hasAttribute('data-keszlet-fut'), shake: getComputedStyle(el.querySelector('[data-utolso]')).animationName, bar: (() => { const m = getComputedStyle(el.querySelector('[data-keszlet] i')).transform; return m === 'none' ? 1 : Number(m.match(/matrix\(([^,]+)/)?.[1]); })(), label: el.querySelector('[data-keszlet]').getAttribute('aria-label') }));
  ok(pre.fut && /lastShake/.test(pre.shake) && Math.abs(pre.bar - 0.2) < 0.05 && /Még 2 darab a 10/.test(pre.label), `„Utolsó darabok!” megrázkódik, a készletsáv 20%-ra fogyott (${pre.bar.toFixed(2)}, ${pre.label})`);

  // Galéria fotói: egérrel billennek, és beúszás után is ferdék
  await p.$eval('#galeria', el => el.scrollIntoView({ block: 'center' }));
  await wait(1200);
  const photo = await p.$('[data-nyomat]');
  const box = await photo.boundingBox();
  await p.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.45);
  await p.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.4);
  await wait(150);
  const tilted = await p.$eval('[data-nyomat]', el => ({ on: el.hasAttribute('data-billen'), ry: el.style.getPropertyValue('--ry') }));
  ok(tilted.on && Math.abs(parseFloat(tilted.ry)) > 1, `egérrel fölé menve megbillen (${tilted.ry})`);
  await p.screenshot({ path: `${SHOTS}mozgas-galeria-billen.jpg`, quality: 60 });
  await p.mouse.move(5, 5);
  await wait(500);
  const rest = await p.$eval('[data-nyomat]', el => ({ on: el.hasAttribute('data-billen'), t: getComputedStyle(el).transform }));
  ok(!rest.on && rest.t !== 'none' && !/^matrix\(1, 0, 0, 1/.test(rest.t), 'elengedve visszaáll, és ferde marad (nem egyenesedik ki)');

  // sikeres asztalfoglalás: az ablak bezárásakor felbillen a „FOGLALT” tábla az adatokkal
  await p.$eval('[data-asztalfoglalas]', el => el.scrollIntoView({ block: 'center' }));
  await wait(400);
  await p.click('[data-asztalfoglalas] a[data-table]');
  await wait(1200);
  await p.evaluate(() => window.postMessage({ type: 'tavern:asztal-foglalva', store: 'Tavern Debrecen', date: '2026-11-28', from: '14:00', people: 4 }, window.location.origin));
  await wait(200);
  await p.keyboard.press('Escape');
  await wait(1800);
  const tent = await p.$eval('[data-asztalfoglalas]', el => ({ who: el.querySelector('[data-tabla-adat]')?.textContent || '', note: el.querySelector('[data-foglalas-kesz]')?.textContent || '' }));
  ok(/Tavern Debrecen/.test(tent.who) && /14:00/.test(tent.who) && /4 fő/.test(tent.who) && /november 28/.test(tent.who), `a táblán a foglalás (${tent.who})`);
  ok(/Elküldtük/.test(tent.note), 'megerősítő mondat');
  await p.screenshot({ path: `${SHOTS}mozgas-foglalt.jpg`, quality: 60 });

  // albumnyitás: a Galériából egy albumra kattintva nézetátmenet indul, az album oldalán a fejléckép
  const g = await page(b, null);
  await g.evaluateOnNewDocument(() => {
    window.__vt = 0;
    const orig = document.startViewTransition?.bind(document);
    if (orig) document.startViewTransition = (...args) => { window.__vt++; return orig(...args); };
  });
  await g.goto(`${BASE}/galeria`, { waitUntil: 'networkidle2' });
  await g.click('[data-album]');
  await g.waitForSelector('[data-album-hero]', { timeout: 20000 });
  await wait(600);
  ok(await g.evaluate(() => window.__vt) >= 1 && g.url().endsWith('/galeria/pokeween-2026'), `albumnyitáskor nézetátmenet (átnövés) és az album fejlécképe (${await g.evaluate(() => window.__vt)} átmenet)`);
  await g.screenshot({ path: `${SHOTS}mozgas-album.jpg`, quality: 60 });

  // csökkentett mozgás: a szűrés nem animál
  const r = await page(b, null);
  await r.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await r.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
  await r.evaluate(() => [...document.querySelectorAll('#program [role="group"] button')].find(x => x.textContent === 'Magic').click());
  await wait(60);
  ok(await r.$$eval('[data-esemeny]', els => els.length === 1 && els.every(e => e.getAnimations().length === 0)), 'csökkentett mozgásnál a szűrés azonnali, animáció nélkül');
  console.log('  böngészőhibák:', [...p.errs, ...g.errs, ...r.errs].join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
