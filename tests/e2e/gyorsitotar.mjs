// Gyorsítótár (lib/publicCache.js): a nyilvános oldalak adatai a tárolóból jönnek (a közvetlen adatbázis-módosítást nem
// látják azonnal), de minden írás (jelentkezés, előrendelés, takarítás) a címkéje szerint azonnal frissíti őket.
// A nyilvános naptár JSON-ját a Vercel CDN is tárolja (Vercel-CDN-Cache-Control); a saját írás után egy percig a
// tavern_friss süti miatt a böngésző egyedi címmel kér. Külön körben fut, bekapcsolt gyorsítótárral (PUBLIC_CACHE=1).
import { openDb, browser, page, ok, summary, wait, BASE } from './lib.mjs';

const { client, db } = await openDb();
const pad = (n) => String(n).padStart(2, '0');
const day = (o) => { const d = new Date(); d.setDate(d.getDate() + o); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const evId = (await db.collection('tournaments').insertOne({ name: 'Tárolt verseny', date: `${day(4)}T18:00`, category: 'Pokémon TCG', store: 'debrecen', max_players: 20, current_players: 0, is_open: true })).insertedId;
const ev = String(evId);
const prodA = String((await db.collection('preorder_products').insertOne({ name: 'Első doboz', category: 'Pokémon TCG', perPersonLimit: 0, isOpen: true, createdAt: new Date(Date.now() - 1000) })).insertedId);
const post = async (path, body) => { const r = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, cookie: r.headers.get('set-cookie') || '', data: await r.json().catch(() => ({})) }; };
const calendar = async () => { const r = await fetch(`${BASE}/api/public-data`); return { cdn: r.headers.get('vercel-cdn-cache-control') || '', data: await r.json() }; };
const nameIn = (d) => d.tournaments.find(t => String(t._id) === ev)?.name;
const html = async (path) => (await fetch(`${BASE}${path}`)).text();

const b = await browser();
try {
  // a fejlesztői szerver adat-gyorsítótára a futások között is megmarad (.next): a takarítás mindent frissít
  ok((await fetch(`${BASE}/api/cron/cleanup`, { headers: { Authorization: 'Bearer e2e-cron-titok' } })).status === 200, 'kiinduló állapot: a tároló kiürítve');
  // --- a nyilvános naptár adata ---
  const first = await calendar();
  ok(nameIn(first.data) === 'Tárolt verseny' && /max-age=15/.test(first.cdn), `a naptár adata, a CDN 15 mp-ig tárolhatja (${first.cdn}; ${nameIn(first.data)}; ${first.data.tournaments?.length})`);
  ok(typeof first.data.serverTime === 'number' && Math.abs(first.data.serverTime - Date.now()) < 5000, 'a szerver ideje nem a tárolt adatból jön (mindig friss)');
  await html(`/esemeny/${ev}`); // az eseményoldal adata is bekerül a tárolóba
  await db.collection('tournaments').updateOne({ _id: evId }, { $set: { name: 'Átnevezett verseny' } });
  const evPageBefore = await html(`/esemeny/${ev}`);
  const second = nameIn((await calendar()).data);
  ok(second === 'Tárolt verseny', `a közvetlen adatbázis-módosítás nem látszik azonnal: a tárolóból jön (${second})`);

  // jelentkezés: utána friss az adat, és a válasz beállítja a friss-sütit
  const join = await post('/api/actions', { actionType: 'JOIN_TOURNAMENT', payload: { tournamentId: ev, username: 'tarolo', name: 'Tároló Tamás', email: 'tamas@pelda.hu' } });
  ok(join.status === 200, `jelentkezés sikeres (${join.status} ${JSON.stringify(join.data).slice(0, 80)})`);
  ok(/tavern_friss=1/.test(join.cookie) && /Max-Age=60/i.test(join.cookie), `írás után egy percig friss adatot kér a böngésző (${join.cookie.split(';')[0]})`);
  const after = (await calendar()).data;
  const t = after.tournaments.find(x => String(x._id) === ev);
  ok(t?.name === 'Átnevezett verseny' && (t.attendees?.length || t.current_players || 0) >= 1, `a jelentkezés után azonnal friss: új név, 1 jelentkező (${t?.name})`);
  const evPageAfter = await html(`/esemeny/${ev}`);
  ok(/Tárolt verseny/.test(evPageBefore) && /Átnevezett verseny/.test(evPageAfter), 'az eseményoldal is frissült a jelentkezés után');

  // a böngésző a friss-süti mellett egyedi címmel kéri a naptárat (a CDN tárolóját megkerülve)
  const p = await page(b, null, 402, 874);
  const urls = [];
  p.on('request', r => { if (r.url().includes('/api/public-data')) urls.push(r.url()); });
  await p.goto(`${BASE}/naptar`, { waitUntil: 'networkidle2', timeout: 240000 });
  ok(urls.length > 0 && urls.every(u => !/friss=/.test(u)), `friss-süti nélkül a sima címet kéri (CDN-ből jöhet) (${urls[0]?.replace(BASE, '')})`);
  await p.setCookie({ name: 'tavern_friss', value: '1', url: BASE });
  urls.length = 0;
  await p.reload({ waitUntil: 'networkidle2' });
  ok(urls.length > 0 && urls.every(u => /friss=\d+/.test(u)), `saját írás után egyedi címmel kér (${urls[0]?.replace(BASE, '')})`);
  await p.close();

  // --- előrendelés ---
  ok((await html('/elorendeles')).includes('Első doboz'), 'az előrendelő oldal mutatja a terméket');
  await db.collection('preorder_products').insertOne({ name: 'Második doboz', category: 'Pokémon TCG', perPersonLimit: 0, isOpen: true, createdAt: new Date() });
  ok(!(await html('/elorendeles')).includes('Második doboz'), 'a közvetlenül felvett termék még nem látszik (tárolóból)');
  const pre = await post('/api/preorders', { name: 'Tároló Tamás', email: 'tamas@pelda.hu', phone: '+36 30 123 4567', items: [{ productId: prodA, quantity: 1 }] });
  ok(pre.status === 200, `előrendelés sikeres (${pre.status})`);
  ok((await html('/elorendeles')).includes('Második doboz'), 'az előrendelés után azonnal friss az oldal');

  // --- weboldal: a takarítás (időzítő) minden nyilvános adatot frissít ---
  await wait(200);
  const homeBefore = await html('/');
  await db.collection('tournaments').updateOne({ _id: evId }, { $set: { name: 'Takarítás utáni név' } });
  ok(!(await html('/')).includes('Takarítás utáni név'), 'a weboldal heti programja is a tárolóból jön');
  const cron = await fetch(`${BASE}/api/cron/cleanup`, { headers: { Authorization: 'Bearer e2e-cron-titok' } });
  ok(cron.status === 200, `a takarítás lefutott (${cron.status})`);
  ok((await html('/')).includes('Takarítás utáni név') && homeBefore.length > 1000, 'a takarítás után a weboldal is friss');
} finally {
  await b.close(); await client.close(); summary();
}
