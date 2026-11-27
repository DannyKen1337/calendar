// Előrendelés: „Megérkezett” értesítő. A termék kártyáján a gomb ablakot nyit az előre megírt, szerkeszthető levéllel és
// élő előnézettel; kiküldéskor minden feliratkozó külön levelet kap a saját nevével és darabszámával. Akinek már átadták,
// és aki már megkapta, alapból kimarad (a félbeszakadt küldés folytatható). Hamis SMTP-szerverrel (levelezős kör).
import { openDb, token, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';
import { startSmtp } from './fake-smtp.mjs';

const { client, db } = await openDb();
const owner = (await db.collection('users').insertOne({ username: 'ErtTulaj', email: 'et@x.hu', password: 'x', role: 'owner', lastSeenChangelog: '9999' })).insertedId;
const org = (await db.collection('users').insertOne({ username: 'ErtSzervezo', email: 'es@x.hu', password: 'x', role: 'admin', features: ['preorders'], allowedCategories: ['One Piece Card Game'], lastSeenChangelog: '9999' })).insertedId;
const tok = await token(owner, 'ErtTulaj', 'owner');
const orgTok = await token(org, 'ErtSzervezo', 'admin');
const prod = String((await db.collection('preorder_products').insertOne({ name: 'Ascended Heroes ETB', category: 'Pokémon TCG', price: 24990, perPersonLimit: 0, isOpen: true, createdAt: new Date() })).insertedId);
await db.collection('preorders').insertMany([
  { productId: prod, name: 'Első Emese', email: 'emese@pelda.hu', phone: '+36 30 111 1111', quantity: 2, date: new Date(Date.now() - 3000) },
  { productId: prod, name: 'Második Márk', email: 'mark@pelda.hu', phone: '+36 30 222 2222', quantity: 1, date: new Date(Date.now() - 2000) },
  { productId: prod, name: 'Átvett Ádám', email: 'adam@pelda.hu', phone: '+36 30 333 3333', quantity: 1, date: new Date(Date.now() - 1000), handedOverAt: new Date() },
]);
const api = async (t, body) => {
  const r = await fetch(`${BASE}/api/admin-preorders`, { method: 'POST', headers: { Cookie: `tavern_session=${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};
const smtp = await startSmtp();
const b = await browser();
try {
  // jog: más játék szervezője nem küldhet
  ok((await api(orgTok, { actionType: 'SEND_ARRIVAL_NOTICE', payload: { productId: prod, subject: 'x', body: 'y' } })).status === 403, 'más játék szervezője nem küldhet értesítőt');
  ok((await api(tok, { actionType: 'SEND_ARRIVAL_NOTICE', payload: { productId: prod, subject: '', body: 'y' } })).status === 400 && (await smtp.mails()).length === 0, 'üres tárggyal nem küld');

  const p = await page(b, tok);
  await p.goto(`${BASE}/admin/elorendeles`, { waitUntil: 'networkidle2', timeout: 240000 });
  await p.waitForSelector('[data-megerkezett]', { timeout: 30000 }).catch(() => {});
  ok(!!(await p.$('[data-megerkezett]')), 'a termék kártyáján „Megérkezett” gomb');
  await p.click('[data-megerkezett]');
  await p.waitForSelector('[data-ertesites]', { timeout: 10000 }).catch(() => {});
  const subj = await p.$eval('#ertesites-targy', i => i.value).catch(() => '');
  const body = await p.$eval('#ertesites-szoveg', i => i.value).catch(() => '');
  ok(subj === 'Megérkezett: Ascended Heroes ETB' && body.includes('Ascended Heroes ETB') && body.includes('{név}'), 'előre megírt levél a termék nevével');
  const prev = await p.$eval('[data-ertesites-elonezet]', el => el.textContent).catch(() => '');
  ok(/Kedves Első Emese!/.test(prev) && /Ascended Heroes ETB \(2 db\)/.test(prev), 'előnézet az első címzett nevével és darabszámával');
  const names = await p.$eval('[data-ertesites-cimzettek]', el => el.textContent);
  ok(/Első Emese/.test(names) && /Második Márk/.test(names) && !/Átvett Ádám/.test(names), 'akinek már átadták, alapból kimarad a címzettek közül');
  // szerkesztés: az előnézet élőben frissül
  await p.click('#ertesites-szoveg', { clickCount: 1 });
  await p.keyboard.down('Meta'); await p.keyboard.press('a'); await p.keyboard.up('Meta');
  await p.keyboard.press('Backspace');
  await p.$eval('#ertesites-szoveg', el => { el.value = ''; });
  await p.type('#ertesites-szoveg', 'Szia {név}!\n\nA(z) Ascended Heroes ETB megjött, {darab} db vár rád a pultnál. Gyere be szombatig!');
  await wait(300);
  const prev2 = await p.$eval('[data-ertesites-elonezet]', el => el.textContent);
  ok(/Szia Első Emese!/.test(prev2) && /2 db vár rád a pultnál/.test(prev2), 'a szerkesztett szöveg azonnal látszik az előnézetben');
  await p.screenshot({ path: `${SHOTS}elorendeles-ertesites.jpg`, quality: 60 });
  ok(/Kiküldés \(2 fő\)/.test(await p.$eval('[data-ertesites-kuld]', el => el.textContent)), 'a gomb mutatja, hány embernek megy');

  // kiküldés megerősítéssel
  await p.click('[data-ertesites-kuld]');
  await wait(400);
  await p.evaluate(() => [...document.querySelectorAll('.ant-popconfirm button')].find(x => x.textContent.trim() === 'Kiküldés')?.click());
  let mails = [];
  for (let i = 0; i < 60 && mails.length < 2; i++) { mails = await smtp.mails(); if (mails.length < 2) await wait(250); }
  await wait(800);
  mails = await smtp.mails();
  const emese = mails.find(m => m.to.includes('emese@pelda.hu'));
  const mark = mails.find(m => m.to.includes('mark@pelda.hu'));
  ok(mails.length === 2 && !!emese && !!mark && !mails.some(m => m.to.includes('adam@pelda.hu')), `két levél ment ki, az átvevőnek nem (${mails.map(m => m.to).join(' | ')})`);
  ok(emese?.to.length === 1 && emese.subject === 'Megérkezett: Ascended Heroes ETB', 'mindenki külön levelet kap (a címeket egymás nem látják)');
  ok(/Szia Első Emese!/.test(emese?.text) && /2 db vár rád/.test(emese?.text) && /Szia Második Márk!/.test(mark?.text) && /1 db vár rád/.test(mark?.text), 'a levélben a saját neve és darabszáma, a szerkesztett szöveggel');
  ok(/Szia Első Emese!/.test(emese?.html), 'HTML-ben is');
  const rows = await db.collection('preorders').find({ productId: prod }).toArray();
  ok(rows.filter(r => r.arrivalMailAt).length === 2, 'a kiküldött leveleknél megjegyezve (arrivalMailAt)');
  ok(!!(await db.collection('audit_logs').findOne({ action: 'ELŐRENDELÉS ÉRTESÍTÉS', details: /2 levél kiment/ })), 'naplózva');
  await p.waitForSelector('[data-ertesitve]', { timeout: 15000 }).catch(() => {});
  ok(/Értesítve \(2 fő\)/.test(await p.$eval('[data-ertesitve]', el => el.textContent).catch(() => '')), 'a terméken „Értesítve (2 fő)” címke');

  // újra: aki megkapta, kimarad; nincs kinek
  await p.click('[data-megerkezett]');
  await p.waitForSelector('[data-ertesites]');
  await wait(300);
  ok(/Kiküldés \(0 fő\)/.test(await p.$eval('[data-ertesites-kuld]', el => el.textContent)) && !!(await p.$('[data-ertesites-ujra]')), 'másodszorra alapból senki (a már értesítettek kimaradnak), de bepipálható');
  ok((await api(tok, { actionType: 'SEND_ARRIVAL_NOTICE', payload: { productId: prod, subject: 'x', body: 'y' } })).status === 400, 'a szerver sem küld újra annak, aki már megkapta');
  const again = await api(tok, { actionType: 'SEND_ARRIVAL_NOTICE', payload: { productId: prod, subject: 'Emlékeztető', body: 'Szia {név}!', skipNotified: false, skipHanded: false } });
  ok(again.data.sent === 3, `kérésre mindenkinek újra (${again.data.sent})`);

  // napi felső határ (a postafiók küldési korlátja miatt): a maradék holnapra marad
  await db.collection('rate_limits').insertMany(Array.from({ length: 294 }, () => ({ key: 'arrival-mail', at: new Date() })));
  const capped = await api(tok, { actionType: 'SEND_ARRIVAL_NOTICE', payload: { productId: prod, subject: 'Még egyszer', body: 'Szia {név}!', skipNotified: false, skipHanded: false } });
  ok(capped.data.sent === 1 && capped.data.later === 2, `napi 300 fölött nem küld, a maradékot jelzi (${capped.data.sent} kiment, ${capped.data.later} holnapra)`);
  const full = await api(tok, { actionType: 'SEND_ARRIVAL_NOTICE', payload: { productId: prod, subject: 'Még egyszer', body: 'Szia {név}!', skipNotified: false, skipHanded: false } });
  ok(full.status === 429 && /holnap/i.test(full.data.error || ''), 'ha betelt a napi keret, érthető hibát ad');
  console.log('  böngészőhibák:', p.errs.join(' | ') || 'nincs');
} finally {
  await b.close(); await smtp.close(); await client.close(); summary();
}
