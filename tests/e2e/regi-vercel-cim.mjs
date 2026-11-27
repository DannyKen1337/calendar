// A régi cím (taverncalendar.vercel.app): minden oldal a www.tavern.hu ugyanazon útjára költözik (308, a paraméterekkel),
// a régi gyökér a naptárra; a régi címen belépett szervező az új admin belépőjére kerül; az API (az ICS kivételével) és
// a beküldés (POST) nem költözik. A rejtett admin körében fut (ADMIN_PATH=/kapu-teszt-2026).
import { openDb, token, ok, summary, BASE } from './lib.mjs';

const { client, db } = await openDb();
const owner = (await db.collection('users').insertOne({ username: 'RegiTulaj', email: 'r@pelda.hu', password: 'x', role: 'owner', lastSeenChangelog: '9999' })).insertedId;
const OLD = 'taverncalendar.vercel.app';
const LIVE = 'https://www.tavern.hu';
const req = (path, { method = 'GET', cookie, host = OLD, body } = {}) => fetch(`${BASE}${path}`, {
  method, redirect: 'manual',
  headers: { 'x-forwarded-host': host, ...(cookie && { Cookie: `tavern_session=${cookie}` }), ...(body && { 'Content-Type': 'application/json' }) },
  ...(body && { body: JSON.stringify(body) }),
});

try {
  const cases = [
    ['/', '/naptar'],
    ['/naptar', '/naptar'],
    ['/elorendeles?termek=6650a1b2c3d4e5f6a7b8c9d0', '/elorendeles?termek=6650a1b2c3d4e5f6a7b8c9d0'],
    ['/elorendeles?bolt=miskolc&jatek=pokemon-tcg', '/elorendeles?bolt=miskolc&jatek=pokemon-tcg'],
    ['/esemeny/6650a1b2c3d4e5f6a7b8c9d0', '/esemeny/6650a1b2c3d4e5f6a7b8c9d0'],
    ['/jelentkezes/6650a1b2c3d4e5f6a7b8c9d0', '/jelentkezes/6650a1b2c3d4e5f6a7b8c9d0'],
    ['/leiratkozas?token=abc123', '/leiratkozas?token=abc123'],
    ['/embed?store=debrecen', '/embed?store=debrecen'],
    ['/liga/pokemon-tcg', '/liga/pokemon-tcg'],
    ['/asztalfoglalas?bolt=debrecen', '/asztalfoglalas?bolt=debrecen'],
    ['/api/export?store=debrecen', '/api/export?store=debrecen'],
    ['/admin', '/admin'],
  ];
  for (const [from, to] of cases) {
    const r = await req(from);
    ok(r.status === 308 && r.headers.get('location') === `${LIVE}${to}`, `${from} → www.tavern.hu${to} (${r.status} ${r.headers.get('location')})`);
  }
  // belépett szervező: az új admin belépőjére (a titkos cím), ahonnan a kapu-sütivel az adminra jut
  const own = await token(owner, 'RegiTulaj', 'owner');
  const adm = await req('/admin/levelek', { cookie: own });
  ok([307, 308].includes(adm.status) && adm.headers.get('location') === `${LIVE}/kapu-teszt-2026`, `belépett szervező: a régi admin címről az új admin belépőjére (${adm.headers.get('location')})`);
  const fake = await req('/admin', { cookie: 'hamis.suti.ertek' });
  ok(fake.headers.get('location') === `${LIVE}/admin`, 'hamis sütivel nem derül ki a titkos cím');
  // ami nem költözik
  ok((await req('/api/public-data')).status === 200, 'az API a régi címen tovább válaszol (nyitott régi lap)');
  ok((await req('/api/cron/mailbox')).status === 401, 'az időzítők útja nem irányít át');
  ok((await req('/api/actions', { method: 'POST', body: { actionType: 'X' } })).status !== 308, 'a beküldés (POST) nem irányít át');
  // az új címen semmi nem változik
  ok((await req('/naptar', { host: 'www.tavern.hu' })).status === 200, 'az új címen nincs átirányítás');
} finally {
  await client.close(); summary();
}
