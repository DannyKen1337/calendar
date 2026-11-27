// Levél a szervezőknek (Továbbiak › Tulajdonos): az előre megírt körlevél (az admin címmel, a weboldal és a naptár
// linkjével) szerkeszthető, előnézettel; kiküldéskor minden aktív, e-mail címmel rendelkező szervező külön levelet kap a
// saját nevével, a küldő aláírásával és feladónevével, a válasz a küldőhöz megy. A „Beérkezett levelek” joggal
// (a tulajdonosnak mindig) használható; ha egy szervező küldi, a tulajdonos is megkapja.
// Hamis SMTP-szerverrel (levelezős kör).
import { openDb, token, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';
import { startSmtp } from './fake-smtp.mjs';

const { client, db } = await openDb();
const ids = (await db.collection('users').insertMany([
  { username: 'KorTulaj', fullName: 'Tulaj Tamás', email: 'tamas@pelda.hu', password: 'x', role: 'owner', lastSeenChangelog: '9999' },
  { username: 'szerv1', fullName: 'Szervező Szilvi', email: 'szilvi@pelda.hu', password: 'x', role: 'admin', lastSeenChangelog: '9999' },
  { username: 'szerv2', fullName: 'Postás Pál', email: 'szerv2@pelda.hu', password: 'x', role: 'admin', features: ['mailbox'], lastSeenChangelog: '9999' },
  { username: 'felfuggesztett', email: 'ff@pelda.hu', password: 'x', role: 'admin', disabled: true, lastSeenChangelog: '9999' },
  { username: 'jatekos', email: 'j@pelda.hu', password: 'x', role: 'customer', lastSeenChangelog: '9999' },
])).insertedIds;
const owner = await token(ids[0], 'KorTulaj', 'owner');
const org = await token(ids[1], 'szerv1', 'admin');
const smtp = await startSmtp();
const b = await browser();
try {
  ok((await fetch(`${BASE}/api/staff-mail`, { headers: { Cookie: `tavern_session=${org}` } })).status === 403, '„Beérkezett levelek” jog nélkül nem küldhet körlevelet');
  const p = await page(b, owner, 402, 874);
  await p.goto(`${BASE}/admin?lap=tovabbiak`, { waitUntil: 'networkidle2', timeout: 240000 });
  await p.waitForFunction(() => [...document.querySelectorAll('button')].some(x => /Levél a szervezőknek/.test(x.textContent)), { timeout: 40000 }).catch(() => {});
  await p.evaluate(() => [...document.querySelectorAll('button')].find(x => /Levél a szervezőknek/.test(x.textContent))?.click());
  await p.waitForSelector('#korlevel-szoveg', { timeout: 15000 }).catch(() => {});
  const draft = await p.$eval('#korlevel-szoveg', el => el.value).catch(() => '');
  ok(/admin felület új címe: http:\/\/localhost:3179\/admin/.test(draft) && /weboldalunk: http:\/\/localhost:3179\n/.test(draft) && /naptár: http:\/\/localhost:3179\/naptar/.test(draft) && /reklámozzátok/.test(draft) && /Tulaj Tamás\nTavern$/.test(draft), 'előre megírt levél: admin link, weboldal, naptár, reklámozás, a tulajdonos aláírásával');
  const recips = await p.$eval('[data-korlevel]', el => el.innerText);
  ok(/Címzettek: 2 szervező/.test(recips) && /Szervező Szilvi/.test(recips) && !/felfuggesztett|jatekos|Tulaj Tamás\n/.test(recips.split('Tárgy')[0]), 'címzettek: az aktív szervezők (nem a felfüggesztett, a játékos, a tulajdonos)');
  await p.screenshot({ path: `${SHOTS}korlevel.jpg`, quality: 60 });
  await p.click('[data-korlevel-kuld]');
  await wait(400);
  await p.evaluate(() => [...document.querySelectorAll('.ant-popconfirm button')].find(x => x.textContent.trim() === 'Kiküldés')?.click());
  let mails = [];
  for (let i = 0; i < 50 && mails.length < 2; i++) { mails = await smtp.mails(); if (mails.length < 2) await wait(200); }
  const szilvi = mails.find(m => m.to.includes('szilvi@pelda.hu'));
  ok(mails.length === 2 && !!szilvi && !!mails.find(m => m.to.includes('szerv2@pelda.hu')) && !mails.some(m => m.to.includes('ff@pelda.hu')), `két szervezőnek ment ki, külön levélben (${mails.map(m => m.to).join(' | ')})`);
  ok(szilvi?.subject === 'Új admin link, és él a tavern.hu' && /^Szia Szervező Szilvi!/.test(szilvi.text) && /Tulaj Tamás\nTavern/.test(szilvi.text), 'megszólítás a szervező nevével, a tulajdonos aláírásával');
  ok(szilvi?.from?.name === 'Tulaj Tamás – Tavern' && szilvi?.replyTo.includes('tamas@pelda.hu'), `feladó a tulajdonos neve, a válasz hozzá megy (${szilvi?.from?.name}, ${szilvi?.replyTo})`);
  ok(!!(await db.collection('audit_logs').findOne({ action: 'KÖRLEVÉL', details: /2 kiment/ })), 'naplózva');

  // a „Beérkezett levelek” joggal egy szervező is küldhet: a tulajdonos is megkapja, a küldő aláírásával
  const postas = await token(ids[2], 'szerv2', 'admin');
  const g = await (await fetch(`${BASE}/api/staff-mail`, { headers: { Cookie: `tavern_session=${postas}` } })).json();
  ok(g.recipients?.length === 2 && g.recipients.some(r => r.name === 'Tulaj Tamás') && g.recipients.some(r => r.name === 'Szervező Szilvi') && /Postás Pál\nTavern$/.test(g.body), `a joggal rendelkező szervezőnél: a tulajdonos is címzett, a saját aláírásával (${(g.recipients || []).map(r => r.name).join(', ')})`);
  const before = (await smtp.mails()).length;
  const r2 = await fetch(`${BASE}/api/staff-mail`, { method: 'POST', headers: { Cookie: `tavern_session=${postas}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: 'Teszt', body: 'Szia {név}!' }) });
  ok(r2.status === 200, 'a joggal rendelkező szervező ki is küldheti');
  let after = []; for (let i = 0; i < 50 && after.length < before + 2; i++) { after = await smtp.mails(); if (after.length < before + 2) await wait(200); }
  const toOwner = after.slice(before).find(m => m.to.includes('tamas@pelda.hu'));
  ok(!!toOwner && toOwner.from?.name === 'Postás Pál – Tavern' && toOwner.replyTo.includes('szerv2@pelda.hu'), 'a tulajdonos is megkapja, a küldő nevével és válaszcímével');
  const pp = await page(b, postas, 402, 874);
  await pp.goto(`${BASE}/admin?lap=tovabbiak`, { waitUntil: 'networkidle2' });
  await pp.waitForFunction(() => /Beérkezett levelek/.test(document.body.innerText), { timeout: 40000 }).catch(() => {});
  ok(await pp.evaluate(() => [...document.querySelectorAll('button')].some(x => /Levél a szervezőknek/.test(x.textContent))), 'a joggal rendelkező szervezőnél ott a gomb a Továbbiak fülön');
  const so = await page(b, org, 402, 874);
  await so.goto(`${BASE}/admin?lap=tovabbiak`, { waitUntil: 'networkidle2' });
  await so.waitForFunction(() => /Fiók/.test(document.body.innerText), { timeout: 40000 }).catch(() => {});
  ok(!(await so.evaluate(() => [...document.querySelectorAll('button')].some(x => /Levél a szervezőknek/.test(x.textContent)))), 'jog nélkül nincs gomb');
  console.log('  böngészőhibák:', p.errs.join(' | ') || 'nincs');
} finally {
  await b.close(); await smtp.close(); await client.close(); summary();
}
