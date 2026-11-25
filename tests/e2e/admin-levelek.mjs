// Beérkezett levelek (/admin/levelek): a rendszer postafiókjába érkezett levelek, csak olvasásra, a „Beérkezett levelek”
// joggal (és a tulajdonosnak). A jog nélkül sem az API, sem a menüpont nem érhető el; a jogot csak a tulajdonos adhatja
// (a felhasználókezelő sem). A leveleket a teszt közvetlenül az adatbázisba írja (mintha a postafiókból jöttek volna).
import { openDb, token, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';

const { client, db } = await openDb();
const ids = (await db.collection('users').insertMany([
  { username: 'Tulaj', email: 'o@x.hu', password: 'x', role: 'owner', lastSeenChangelog: '9999' },
  { username: 'Postas', email: 'p@x.hu', password: 'x', role: 'admin', features: ['personalBasic'], lastSeenChangelog: '9999' },
  { username: 'Kezelo', email: 'k@x.hu', password: 'x', role: 'admin', features: ['users'], lastSeenChangelog: '9999' },
])).insertedIds;
const [OWNER, POST, USERS] = [0, 1, 2].map(i => ids[i]);
const tok = { owner: await token(OWNER, 'Tulaj', 'owner'), post: await token(POST, 'Postas', 'admin'), users: await token(USERS, 'Kezelo', 'admin') };
await db.collection('inbox_mails').insertMany([
  { _id: '<a1@teszt>', uid: 1, from: { name: 'Nagyker Kft.', address: 'rendeles@nagyker.hu' }, to: [{ name: '', address: 'tavern.naptar@gmail.com' }], subject: 'Szállítás csütörtökön', date: new Date(Date.now() - 3600000), text: 'Szia!\n\nA 30. évfordulós ETB-k csütörtökön érkeznek.\n\nÜdv,\nNagyker', attachments: [{ filename: 'szamla.pdf', size: 52000 }] },
  { _id: '<a2@teszt>', uid: 2, from: { name: 'Kiss Anna', address: 'anna@pelda.hu' }, to: [{ name: '', address: 'tavern.naptar+valasz-0123456789abcdef01234567@gmail.com' }], subject: 'Re: ETB előrendelés', date: new Date(), text: 'Köszi, holnap megyek érte!', attachments: [], threadId: 'x' },
]);

const get = async (path, t) => { const r = await fetch(`${BASE}${path}`, { headers: { Cookie: `tavern_session=${t}` } }); return { status: r.status, data: await r.json().catch(() => ({})) }; };
const post = async (path, t, body) => { const r = await fetch(`${BASE}${path}`, { method: 'POST', headers: { Cookie: `tavern_session=${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => ({})) }; };

const b = await browser();
try {
  // jog nélkül
  ok((await get('/api/inbox', tok.post)).status === 403, 'jog nélkül az API 403');
  const p = await page(b, tok.post);
  await p.goto(`${BASE}/admin?lap=tovabbiak`, { waitUntil: 'networkidle2', timeout: 240000 });
  await p.waitForFunction(() => document.body.innerText.includes('Továbbiak'), { timeout: 30000 });
  ok(!(await p.evaluate(() => /Beérkezett levelek/.test(document.body.innerText) || !!document.querySelector('a[href="/admin/levelek"]'))), 'jog nélkül nincs menüpont');

  // a felhasználókezelő nem adhatja meg (csak a tulajdonos)
  const grp = await post('/api/admin-users', tok.users, { actionType: 'SAVE_GROUP', payload: { name: 'Levelek lopva', features: ['mailbox'], categories: [], stores: [] } });
  ok(grp.status === 403, `a felhasználókezelő nem hozhat létre ilyen csoportot (${grp.status})`);
  await get('/api/admin-users', tok.owner); // az alapcsoportok a felhasználókezelő első megnyitásakor jönnek létre
  const mg = await db.collection('user_groups').findOne({ features: ['mailbox'] });
  ok(mg?.name === 'Beérkezett levelek', 'van „Beérkezett levelek” csoport');
  const give = await post('/api/admin-users', tok.users, { actionType: 'SET_USER_GROUPS', payload: { userId: String(POST), groupIds: [String(mg._id)] } });
  ok(give.status === 403 || !((await db.collection('users').findOne({ _id: POST })).groupIds || []).includes(String(mg._id)), 'a felhasználókezelő nem adhatja oda');

  // a tulajdonos megadja
  const own = await post('/api/admin-users', tok.owner, { actionType: 'SET_USER_GROUPS', payload: { userId: String(POST), groupIds: [String(mg._id)] } });
  ok(own.status === 200, 'a tulajdonos megadja');
  const list = await get('/api/inbox', tok.post);
  ok(list.status === 200 && list.data.mails.length === 2 && list.data.mails[0].subject === 'Re: ETB előrendelés', 'joggal: a levelek, a legújabb elöl');
  ok(list.data.mails[1].snippet.startsWith('Szia!') && !('text' in list.data.mails[1]), 'a listában csak kivonat');
  ok(list.data.status && list.data.status.on === false, 'az állapot: a postafiók olvasása itt nincs beállítva');

  // az oldal
  await p.goto(`${BASE}/admin?lap=tovabbiak`, { waitUntil: 'networkidle2' });
  await p.waitForSelector('a[href="/admin/levelek"]', { timeout: 20000 });
  ok(true, 'joggal: a Továbbiak fülön a menüpont');
  await p.goto(`${BASE}/admin/levelek`, { waitUntil: 'networkidle2' });
  await p.waitForSelector('[data-level]', { timeout: 20000 });
  ok((await p.$$('[data-level]')).length === 2, 'a listában 2 levél');
  ok(await p.evaluate(() => /Válasz szervezőnek/.test(document.querySelector('[data-level]').innerText)), 'a szervezői üzenetre jött válasz jelölve');
  await p.click('[data-level="<a1@teszt>"]');
  await p.waitForFunction(() => /csütörtökön érkeznek/.test(document.querySelector('[data-levelszoveg]')?.innerText || ''), { timeout: 10000 });
  const v = await p.$eval('[data-levelnezet]', el => el.innerText);
  ok(/Szállítás csütörtökön/.test(v) && /rendeles@nagyker\.hu/.test(v) && /szamla\.pdf/.test(v), 'a megnyitott levél: tárgy, feladó, melléklet neve');
  ok(p.url().includes('level='), 'a megnyitott levélnek saját linkje van');
  ok(!(await p.$('textarea')) && !(await p.$eval('[data-levelnezet]', el => [...el.querySelectorAll('button')].some(x => /Válasz|Küldés|Törlés/.test(x.textContent)))), 'csak olvasás: nincs válasz, küldés, törlés');
  await p.type('[data-level-kereso] input', 'anna');
  await wait(300);
  ok((await p.$$('[data-level]')).length === 1, 'keresés a feladóra');
  await p.screenshot({ path: `${SHOTS}levelek-gep.jpg`, quality: 60 });

  // telefon
  const ph = await page(b, tok.post, 402, 874);
  await ph.goto(`${BASE}/admin/levelek`, { waitUntil: 'networkidle2' });
  await ph.waitForSelector('[data-level]');
  await wait(800);
  const sw = await ph.evaluate(() => document.documentElement.scrollWidth);
  ok(sw === 402, `telefonon nincs vízszintes görgetés (${sw})`);
  await ph.click('[data-level]');
  await ph.waitForSelector('[data-levelnezet]');
  ok(await ph.evaluate(() => !document.querySelector('[data-levellista]')?.offsetParent), 'telefonon a levél a lista helyén nyílik');
  await ph.screenshot({ path: `${SHOTS}levelek-telefon.jpg`, quality: 60 });

  // a tulajdonos is látja; az Üzenetek változatlan (a szálat a levél joga nem mutatja meg)
  ok((await get('/api/inbox', tok.owner)).data.mails?.length === 2, 'a tulajdonos is látja');
  ok((await get('/api/messages', tok.post)).data.threads?.length === 0, 'az Üzenetek szálai a levél joggal sem látszanak (azok az íróé)');
  console.log('  böngészőhibák:', [...p.errs, ...ph.errs].join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
