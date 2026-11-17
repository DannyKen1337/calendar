// Admin: jelentkezők és előrendelők adatai két szinten, és üzenet a rendszeren keresztül.
//  - 1. szint (a „Személyes adatok” jog nélkül): csak a felhasználónév és a teljes név; e-mail és telefon az API-válaszban sincs.
//  - 2. szint (personalData): minden adat. A jogot csak a tulajdonos adhatja (a felhasználókezelő sem).
//  - Üzenet: a Jelentkezők ablakból és az előrendelésekből; a szál csak az írójának és a tulajdonosnak látszik; teszt mód
//    (nincs e-mail beállítás): elmentődik, „Teszt válasz” gombbal kipróbálható; az olvasatlan válasz jelzést kap.
//  - A válasz webhookja aláírás nélkül elutasít.
import { openDb, token, browser, page, ok, summary, wait, SHOTS, BASE, ObjectId } from './lib.mjs';

const { client, db } = await openDb();
const pad = (n) => String(n).padStart(2, '0');
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const ids = (await db.collection('users').insertMany([
  { username: 'Tulaj', email: 'o@x.hu', password: 'x', role: 'owner', lastSeenChangelog: '9999' },
  { username: 'Egyes', email: 'e1@x.hu', password: 'x', role: 'admin', features: ['preorders'], lastSeenChangelog: '9999' },
  { username: 'Kettes', email: 'e2@x.hu', password: 'x', role: 'admin', features: ['preorders', 'personalData'], lastSeenChangelog: '9999' },
  { username: 'Kezelo', email: 'k@x.hu', password: 'x', role: 'admin', features: ['users'], lastSeenChangelog: '9999' },
])).insertedIds;
const [OWNER, L1, L2, USERS] = [0, 1, 2, 3].map(i => ids[i]);
const tok = { owner: await token(OWNER, 'Tulaj', 'owner'), l1: await token(L1, 'Egyes', 'admin'), l2: await token(L2, 'Kettes', 'admin'), users: await token(USERS, 'Kezelo', 'admin') };
const ev = (await db.collection('tournaments').insertOne({ name: 'Pokémon Liga', date: `${day(1)}T18:00`, category: 'Pokémon TCG', store: 'debrecen', max_players: 16, current_players: 2, is_open: true, createdAt: new Date() })).insertedId;
const regs = (await db.collection('registrations').insertMany([
  { tournamentId: String(ev), tournamentName: 'Pokémon Liga', username: 'Ash', name: 'Kovács Ádám', email: 'ash.titkos@pelda.hu', status: 'Aktív', date: new Date() },
  { tournamentId: String(ev), tournamentName: 'Pokémon Liga', username: 'Misty', name: 'Nagy Bianka', status: 'Aktív', date: new Date() },
])).insertedIds;
await db.collection('attendance_history').insertOne({ registrationId: 'regi', email: 'ash.titkos@pelda.hu', attended: true });
const prod = (await db.collection('preorder_products').insertOne({ name: 'Mega Evolution ETB', category: 'Pokémon TCG', price: 19990, isOpen: true, createdAt: new Date() })).insertedId;
await db.collection('preorders').insertOne({ productId: String(prod), name: 'Szabó Csilla', email: 'csilla.titkos@pelda.hu', phone: '+36 30 555 1234', quantity: 1, date: new Date() });

const api = (path, t, body) => fetch(`${BASE}${path}`, { method: body ? 'POST' : 'GET', headers: { Cookie: `tavern_session=${t}`, ...(body && { 'Content-Type': 'application/json' }) }, body: body && JSON.stringify(body) });
const json = async (path, t, body) => { const r = await api(path, t, body); return { status: r.status, data: await r.json().catch(() => ({})), text: '' }; };
const raw = async (path, t) => (await api(path, t)).text();

const b = await browser();
try {
  // 1. szint: az API-válaszban nincs e-mail / telefon
  const d1 = await raw('/api/admin-data', tok.l1);
  const a1 = JSON.parse(d1);
  ok(!d1.includes('ash.titkos@pelda.hu'), '1. szint: a jelentkező e-mail címe nincs az admin adatokban');
  ok(a1.registrations.find(r => r.username === 'Ash')?.hasEmail === true && a1.registrations.find(r => r.username === 'Misty')?.hasEmail === false, '1. szint: csak az látszik, hogy írható-e neki');
  ok(a1.attendanceStats[String(regs[0])]?.attended === 1, 'a megbízhatóság a jelentkezéshez kötve (nem e-mailhez)');
  ok(a1.messaging?.personalData === false && a1.messaging?.send === false, '1. szint, teszt mód (nincs e-mail beállítás)');
  const p1 = await raw('/api/admin-preorders', tok.l1);
  ok(!p1.includes('csilla.titkos@pelda.hu') && !p1.includes('555 1234') && p1.includes('Szabó Csilla'), '1. szint: az előrendelőnek csak a neve látszik');
  // 2. szint
  ok((await raw('/api/admin-data', tok.l2)).includes('ash.titkos@pelda.hu'), '2. szint: az e-mail cím látszik');
  const p2 = await raw('/api/admin-preorders', tok.l2);
  ok(p2.includes('csilla.titkos@pelda.hu') && p2.includes('555 1234'), '2. szint: az előrendelő e-mailje és telefonja is');

  // a jogot csak a tulajdonos adhatja
  const grp = await json('/api/admin-users', tok.users, { actionType: 'SAVE_GROUP', payload: { name: 'Lopott', features: ['personalData'], categories: [], stores: [] } });
  ok(grp.status === 403, `a felhasználókezelő nem hozhat létre személyes adatos csoportot (${grp.status})`);

  // 1. szint a felületen: nincs e-mail oszlop, Üzenet gomb
  const p = await page(b, tok.l1);
  p.on('console', m => { if (m.type() === 'error') p.errs.push(`console: ${m.text().slice(0, 300)}`); });
  await p.goto(`${BASE}/admin`, { waitUntil: 'networkidle2', timeout: 240000 });
  await p.waitForFunction(() => document.body.innerText.includes('Pokémon Liga'), { timeout: 60000 });
  await p.evaluate(() => [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Jelentkezők').click());
  await p.waitForSelector('.ant-modal [data-uzenet]', { timeout: 15000 });
  const modal = await p.$eval('.ant-modal', m => ({ heads: [...m.querySelectorAll('th')].map(t => t.textContent), text: m.innerText, buttons: m.querySelectorAll('[data-uzenet]').length }));
  ok(!modal.heads.includes('E-mail') && /Ash/.test(modal.text) && /Kovács Ádám/.test(modal.text) && !/ash\.titkos/.test(modal.text), '1. szint: a Jelentkezők ablakban felhasználónév + teljes név, e-mail oszlop nincs');
  ok(modal.buttons === 1, 'Üzenet gomb annál, akinek van e-mail címe');
  await p.screenshot({ path: `${SHOTS}uzenet-jelentkezok.jpg`, quality: 60 });
  await p.click('.ant-modal [data-uzenet]');
  await p.waitForSelector('[data-uzenet-ablak] textarea');
  await wait(500);
  ok(await p.evaluate(() => document.activeElement?.tagName === 'TEXTAREA'), 'megnyitáskor a kurzor az üzenet mezőben');
  ok(/Teszt mód/.test(await p.$eval('[data-uzenet-ablak]', el => el.innerText)), 'az ablak jelzi a teszt módot');
  await p.type('[data-uzenet-ablak] textarea', 'Szia! Holnap 17:30-kor kezdünk, hozd a paklid.');
  await p.screenshot({ path: `${SHOTS}uzenet-ablak.jpg`, quality: 60 });
  await p.click('[data-uzenet-kuld]');
  await p.waitForFunction(() => /Elmentve az Üzenetek közé/.test(document.body.innerText), { timeout: 10000 }).catch(() => {});
  ok(/Elmentve az Üzenetek közé/.test(await p.evaluate(() => document.body.innerText)), 'küldés után visszajelzés (teszt: elmentve)');
  const th = await db.collection('message_threads').findOne({ refId: String(regs[0]) });
  ok(th && th.toEmail === 'ash.titkos@pelda.hu' && th.createdBy === 'Egyes' && th.messages[0].status === 'saved', 'a szál elmentve, a címet a szerver tudja');

  // kinek látszik a szál
  const m1 = await raw('/api/messages', tok.l1);
  ok(JSON.parse(m1).threads.length === 1 && !m1.includes('ash.titkos') && !m1.includes(th.token), 'az írója látja, e-mail és token nélkül');
  ok((await json('/api/messages', tok.l2)).data.threads.length === 0, 'más szervező (2. szint is) nem látja');
  ok((await json('/api/messages', tok.owner)).data.threads.length === 1, 'a tulajdonos látja');

  // teszt válasz: olvasatlan jelzés, majd az Üzenetek oldalon megnyitva olvasott
  ok((await json('/api/messages', tok.owner, { actionType: 'TEST_REPLY', payload: { threadId: String(th._id), text: 'Köszi, ott leszek!' } })).status === 200, 'teszt válasz (tulajdonos)');
  ok((await json('/api/admin-data', tok.l1)).data.messaging.unread === 1, 'az írónak 1 olvasatlan válasz');
  await p.goto(`${BASE}/admin/uzenetek`, { waitUntil: 'networkidle2' });
  await p.waitForSelector('[data-szal]', { timeout: 15000 });
  ok(await p.$eval('[data-szal]', el => /Ash/.test(el.textContent) && !!el.querySelector('[data-olvasatlan]')), 'az Üzenetek listán „Új válasz”');
  await p.click('[data-szal]');
  await p.waitForSelector('[data-beszelgetes] [data-irany="in"]');
  ok(await p.$eval('[data-beszelgetes]', el => /Köszi, ott leszek!/.test(el.innerText) && /Csak elmentve \(teszt\)/.test(el.innerText)), 'a beszélgetésben a válasz és a kimenő állapota');
  await p.type('[data-valasz]', 'Szuper, várunk!');
  await p.click('[data-valasz-kuld]');
  await p.waitForFunction(() => document.querySelectorAll('[data-beszelgetes] [data-irany="out"]').length === 2, { timeout: 10000 }).catch(() => {});
  ok((await p.$$('[data-beszelgetes] [data-irany="out"]')).length === 2, 'válasz a beszélgetésben');
  await wait(500);
  ok((await db.collection('message_threads').findOne({ _id: th._id })).unread === false, 'megnyitva olvasottnak jelölve');
  await p.screenshot({ path: `${SHOTS}uzenetek-gep.jpg`, quality: 60 });

  // előrendelés: 1. szinten nincs e-mail / telefon oszlop, van Üzenet
  await p.goto(`${BASE}/admin/elorendeles`, { waitUntil: 'networkidle2' });
  await p.waitForFunction(() => document.body.innerText.includes('Mega Evolution ETB'), { timeout: 20000 });
  await p.evaluate(() => [...document.querySelectorAll('button')].find(x => /Jelentkezők|jelentkező/.test(x.textContent))?.click());
  await wait(600);
  const pre = await p.evaluate(() => ({ heads: [...document.querySelectorAll('th')].map(t => t.textContent), text: document.body.innerText, msg: document.querySelectorAll('[data-uzenet]').length }));
  ok(!pre.heads.includes('E-mail') && !pre.heads.includes('Telefon') && !/csilla\.titkos|555 1234/.test(pre.text), '1. szint: az előrendeléseknél nincs e-mail és telefon');
  ok(pre.msg >= 1, 'az előrendelőnek is írható üzenet');
  await p.screenshot({ path: `${SHOTS}uzenet-elorendeles.jpg`, quality: 60 });

  // jogosulatlan címzett: más játék eseménye
  const other = (await db.collection('tournaments').insertOne({ name: 'Magic este', date: `${day(1)}T18:00`, category: 'Magic: The Gathering', store: 'debrecen', max_players: 8, is_open: true })).insertedId;
  const otherReg = (await db.collection('registrations').insertOne({ tournamentId: String(other), username: 'Jace', name: 'Jace', email: 'jace@pelda.hu', status: 'Aktív', date: new Date() })).insertedId;
  await db.collection('users').updateOne({ _id: L1 }, { $set: { allowedCategories: ['Pokémon TCG'] } });
  ok((await json('/api/messages', tok.l1, { actionType: 'SEND', payload: { kind: 'registration', refId: String(otherReg), text: 'x' } })).status === 403, 'nem kezelt esemény jelentkezőjének nem írhat');

  // telefon: az Üzenetek oldal
  const ph = await page(b, tok.l1, 402, 874);
  await ph.goto(`${BASE}/admin/uzenetek`, { waitUntil: 'networkidle2' });
  await ph.waitForSelector('[data-szal]');
  ok((await ph.evaluate(() => document.documentElement.scrollWidth)) === 402, 'telefonon nincs vízszintes görgetés');
  await ph.click('[data-szal]');
  await ph.waitForSelector('[data-beszelgetes]');
  ok(await ph.evaluate(() => !document.querySelector('[data-uzenet-lista]')?.offsetParent), 'telefonon a beszélgetés a lista helyén nyílik');
  await ph.screenshot({ path: `${SHOTS}uzenetek-telefon.jpg`, quality: 60 });

  // webhook aláírás nélkül
  const hook = await fetch(`${BASE}/api/messages/inbound`, { method: 'POST', body: JSON.stringify({ type: 'email.received', data: { to: [`valasz-${th.token}@x.hu`] } }) });
  ok(hook.status === 401, `a válasz-webhook aláírás nélkül elutasít (${hook.status})`);
  ok((await db.collection('message_threads').findOne({ _id: new ObjectId(String(th._id)) })).messages.filter(m => m.dir === 'in').length === 1, 'és nem kerül be semmi');
  // 1. szint mindenkinek: a meglévő szervező megkapta, az új szervező is megkapja; a felhasználókezelő nem veheti el
  ok(((await db.collection('users').findOne({ _id: L1 })).features || []).includes('personalBasic'), 'a meglévő szervező megkapta az 1. szintet');
  const l1g = await db.collection('user_groups').findOne({ features: ['personalBasic'] });
  ok(l1g?.name === 'Személyes adatok: 1. szint', 'van „Személyes adatok: 1. szint” csoport');
  const created = await json('/api/admin-users', tok.owner, { actionType: 'CREATE_USER', payload: { username: 'Ujszervezo', email: 'uj@x.hu', role: 'admin', groupIds: [] } });
  const uj = await db.collection('users').findOne({ username: 'Ujszervezo' });
  ok(created.status === 200 && uj.groupIds.includes(String(l1g._id)), 'az új szervező automatikusan megkapja az 1. szintet');
  const strip = await json('/api/admin-users', tok.users, { actionType: 'SET_USER_GROUPS', payload: { userId: String(uj._id), groupIds: [] } });
  ok(strip.status === 200 && (await db.collection('users').findOne({ _id: uj._id })).groupIds.includes(String(l1g._id)), 'a felhasználókezelő mentésekor az 1. szint megmarad');
  await json('/api/admin-users', tok.owner, { actionType: 'SET_USER_GROUPS', payload: { userId: String(uj._id), groupIds: [] } });
  ok(!(await db.collection('users').findOne({ _id: uj._id })).groupIds.includes(String(l1g._id)), 'a tulajdonos elveheti');
  const ujTok = await token(uj._id, 'Ujszervezo', 'admin');
  ok((await json('/api/messages', ujTok, { actionType: 'SEND', payload: { kind: 'registration', refId: String(regs[0]), text: 'x' } })).status === 403, '1. szint nélkül nem írhat üzenetet');

  // Felhasználók: szűrés jogosultság szerint
  const u = await page(b, tok.owner);
  u.on('console', m => { if (m.type() === 'error') u.errs.push(`console: ${m.text().slice(0, 300)}`); });
  await u.goto(`${BASE}/admin/felhasznalok`, { waitUntil: 'networkidle2' });
  await u.waitForSelector('[data-jog-szuro]', { timeout: 30000 });
  await u.click('[data-jog-szuro]');
  await u.keyboard.type('2. szint');
  await wait(300);
  await u.keyboard.press('Enter');
  await wait(400);
  const hit = await u.$eval('[data-jog-talalat]', el => el.innerText);
  ok(/Személyes adatok: 2\. szint: 2 ember/.test(hit) && /Kettes/.test(hit) && /Tulaj/.test(hit) && !/Egyes/.test(hit), `a jog szerinti szűrés kilistázza, kinek van meg (${hit.replace(/\n/g, ' ')})`);
  const cardsShown = await u.evaluate(() => document.body.innerText.includes('Egyes'));
  ok(!cardsShown, 'a kártyák között is csak ők látszanak');
  await u.screenshot({ path: `${SHOTS}felhasznalok-jog-szures.jpg`, quality: 60 });
  await u.evaluate(() => document.querySelector('[data-jog-szuro] .ant-select-clear')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
  await wait(200);
  await u.type('input[placeholder^="Keresés"]', '1. szint');
  await wait(300);
  ok(await u.evaluate(() => document.body.innerText.includes('Egyes') && !document.body.innerText.includes('Ujszervezo')), 'a szöveges kereső a jog nevére is talál');
  console.log('  böngészőhibák:', [...p.errs, ...ph.errs, ...u.errs].join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
