// Beérkezett levelek: válasz közvetlenül az admin felületről. A válasz a rendszer postafiókjából megy, a belépett
// felhasználó aláírásával és nevével („Kata – Tavern”), az eredeti levél idézve, az eredeti szálában (In-Reply-To).
// Ha a levélnek Reply-To címe van (pl. az előrendelő oldal kérdései), oda megy; a rendszer saját címére nem.
// Hamis SMTP-szerverrel (levelezős kör: SMTP_USER = bolt@teszt.hu).
import { openDb, token, browser, page, ok, summary, SHOTS, BASE } from './lib.mjs';
import { startSmtp } from './fake-smtp.mjs';

const { client, db } = await openDb();
const ids = (await db.collection('users').insertMany([
  { username: 'Kata', email: 'kata@x.hu', password: 'x', role: 'admin', features: ['mailbox'], lastSeenChangelog: '9999' },
  { username: 'Nincsjog', email: 'n@x.hu', password: 'x', role: 'admin', features: ['preorders'], lastSeenChangelog: '9999' },
])).insertedIds;
const kata = await token(ids[0], 'Kata', 'admin');
const nincs = await token(ids[1], 'Nincsjog', 'admin');
await db.collection('inbox_mails').insertMany([
  { _id: '<v1@teszt>', uid: 1, messageId: '<v1@teszt>', from: { name: 'Nagy Béla', address: 'bela@pelda.hu' }, to: [{ name: '', address: 'bolt@teszt.hu' }], subject: 'Mikor jön az ETB?', date: new Date(Date.now() - 3600000), text: 'Szia!\nMikor jön az ETB?\nBéla', attachments: [] },
  { _id: '<v2@teszt>', uid: 2, messageId: '<v2@teszt>', from: { name: 'Tavern Naptár', address: 'bolt@teszt.hu' }, replyTo: { name: '', address: 'kerdezo@pelda.hu' }, to: [{ name: '', address: 'bolt@teszt.hu' }], subject: 'Kérdés az előrendelésről (Kérdező)', date: new Date(Date.now() - 1800000), text: 'Lesz még booster?', attachments: [] },
  { _id: '<v3@teszt>', uid: 3, messageId: '<v3@teszt>', from: { name: 'Tavern Naptár', address: 'bolt@teszt.hu' }, to: [{ name: '', address: 'bolt@teszt.hu' }], subject: 'Saját levél', date: new Date(Date.now() - 900000), text: 'Rendszerüzenet', attachments: [] },
]);
const post = async (t, body) => { const r = await fetch(`${BASE}/api/inbox`, { method: 'POST', headers: { Cookie: `tavern_session=${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, data: await r.json().catch(() => ({})) }; };
const smtp = await startSmtp();
const b = await browser();
try {
  ok((await post(nincs, { actionType: 'REPLY', id: '<v1@teszt>', text: 'x' })).status === 403, 'a Beérkezett levelek joga nélkül nem lehet válaszolni');
  ok((await post(kata, { actionType: 'REPLY', id: '<v1@teszt>', text: '   ' })).status === 400, 'üres válasz nem megy');
  ok((await post(kata, { actionType: 'REPLY', id: '<v3@teszt>', text: 'Szia' })).status === 400 && (await smtp.mails()).length === 0, 'a rendszer saját címére nem megy válasz');

  // felület: telefonon, a levél alatt válaszmező
  const p = await page(b, kata, 402, 874);
  await p.goto(`${BASE}/admin/levelek?level=${encodeURIComponent('<v1@teszt>')}`, { waitUntil: 'networkidle2', timeout: 240000 });
  await p.waitForSelector('#valasz-szoveg', { timeout: 30000 }).catch(() => {});
  ok(/Válasz neki: bela@pelda\.hu/.test(await p.$eval('[data-valasz]', el => el.textContent).catch(() => '')), 'a levél alatt válaszmező, a címzett látszik');
  ok(/Kata\s*Tavern/.test(await p.$eval('[data-alairas]', el => el.textContent).catch(() => '')), 'az aláírás a belépett felhasználó neve');
  await p.type('#valasz-szoveg', 'Szia Béla!\n\nCsütörtökön érkezik, utána átveheted.');
  await p.screenshot({ path: `${SHOTS}levelek-valasz.jpg`, quality: 60, fullPage: true });
  ok((await p.evaluate(() => document.documentElement.scrollWidth)) === 402, 'telefonon nincs vízszintes görgetés');
  await p.click('[data-valasz-kuld]');
  await p.waitForSelector('[data-elkuldott-valasz]', { timeout: 20000 }).catch(() => {});
  const m = (await smtp.mails()).find(x => x.to.includes('bela@pelda.hu'));
  ok(!!m, 'a válasz kiment a feladónak');
  ok(m?.from?.address === 'bolt@teszt.hu' && m?.from?.name === 'Kata – Tavern', `a rendszer címéről, a belépett felhasználó nevével (${m?.from?.name} <${m?.from?.address}>)`);
  ok(m?.subject === 'Re: Mikor jön az ETB?' && m?.inReplyTo === '<v1@teszt>', `tárgy Re:-vel, az eredeti szálában (${m?.subject}, ${m?.inReplyTo})`);
  ok(/Csütörtökön érkezik, utána átveheted\.\n\nKata\nTavern/.test(m?.text || '') && /> Mikor jön az ETB\?/.test(m?.text || '') && /Kata<br>Tavern/.test(m?.html || ''), 'aláírás alatta, és az eredeti levél idézve');
  const row = await db.collection('inbox_mails').findOne({ _id: '<v1@teszt>' });
  ok(row?.replies?.length === 1 && row.replies[0].by === 'Kata' && row.replies[0].to === 'bela@pelda.hu', 'a levélnél megjegyezve, ki és kinek válaszolt');
  ok(/Kata válaszolt/.test(await p.$eval('[data-elkuldott-valasz]', el => el.textContent).catch(() => '')) && await p.$eval('#valasz-szoveg', el => el.value) === '', 'a felületen látszik az elküldött válasz, a mező kiürül');
  ok(!!(await db.collection('audit_logs').findOne({ action: 'LEVÉL VÁLASZ', adminName: 'Kata' })), 'naplózva');
  await p.screenshot({ path: `${SHOTS}levelek-valasz-elkuldve.jpg`, quality: 60, fullPage: true });

  // a lista „Megválaszolva” címkét mutat
  const g = await page(b, kata);
  await g.goto(`${BASE}/admin/levelek`, { waitUntil: 'networkidle2' });
  await g.waitForSelector('[data-levellista]', { timeout: 30000 }).catch(() => {});
  ok(!!(await g.$(`[data-level="<v1@teszt>"] [data-megvalaszolva]`)) && !(await g.$(`[data-level="<v2@teszt>"] [data-megvalaszolva]`)), 'a listában „Megválaszolva” címke');

  // Reply-To-s levél (az előrendelő oldal kérdése): a kérdezőnek megy
  const r = await post(kata, { actionType: 'REPLY', id: '<v2@teszt>', text: 'Igen, jövő héten.' });
  const m2 = (await smtp.mails()).find(x => x.to.includes('kerdezo@pelda.hu'));
  ok(r.status === 200 && !!m2 && !(await smtp.mails()).some(x => x.to.includes('bolt@teszt.hu')), 'Reply-To címmel a kérdezőnek megy, nem a rendszernek');
  // a saját címről jött levélnél nincs válaszmező
  await g.goto(`${BASE}/admin/levelek?level=${encodeURIComponent('<v3@teszt>')}`, { waitUntil: 'networkidle2' });
  await g.waitForSelector('[data-valasz]', { timeout: 20000 }).catch(() => {});
  ok(!(await g.$('#valasz-szoveg')) && /nem lehet válaszolni/.test(await g.$eval('[data-valasz]', el => el.textContent).catch(() => '')), 'a rendszer saját leveleinél nincs válaszmező');
  console.log('  böngészőhibák:', [...p.errs, ...g.errs].join(' | ') || 'nincs');
} finally {
  await b.close(); await smtp.close(); await client.close(); summary();
}
