// Előrendelés: „Kérdésed van? Írj nekünk” gomb az oldal tetején. Név, e-mail cím és üzenet kötelező; a levél a bolt
// postafiókjába megy (itt: SMTP_USER), a válaszcím a kérdezőé, a tárgyban a termék neve (ha egy termék oldaláról jön).
import { openDb, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';
import { startSmtp } from './fake-smtp.mjs';

const { client, db } = await openDb();
const prod = String((await db.collection('preorder_products').insertOne({ name: 'Kérdéses ETB', category: 'Pokémon TCG', price: 19990, perPersonLimit: 0, isOpen: true, createdAt: new Date() })).insertedId);
const smtp = await startSmtp();
const post = (body) => fetch(`${BASE}/api/preorders/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async r => ({ status: r.status, data: await r.json().catch(() => ({})) }));
const mailFor = async (pred) => { for (let i = 0; i < 50; i++) { const m = (await smtp.mails()).find(pred); if (m) return m; await wait(200); } return null; };

const b = await browser();
try {
  // --- API ---
  ok((await post({ email: 'a@b.hu', message: 'Mikor jön?' })).data.field === 'name', 'név nélkül nem megy');
  ok((await post({ name: 'Anna', email: 'rossz', message: 'Mikor jön?' })).data.field === 'email', 'hibás e-mail címmel nem megy');
  ok((await post({ name: 'Anna', email: 'a@b.hu', message: '' })).data.field === 'message', 'üzenet nélkül nem megy');
  ok((await post({ name: 'Robot', email: 'r@b.hu', message: 'spam spam', website: 'x' })).status === 200 && (await smtp.mails()).length === 0, 'a robotcsapdába esett üzenet nem megy ki');

  // --- Telefonon: a gomb az oldal tetején ---
  const p = await page(b, null, 402, 874);
  await p.goto(`${BASE}/elorendeles?termek=${prod}`, { waitUntil: 'networkidle2', timeout: 240000 });
  const btn = await p.$('[data-kerdes-gomb]');
  const top = btn ? await btn.evaluate(el => ({ y: el.getBoundingClientRect().top, form: document.querySelector('form')?.getBoundingClientRect().top ?? 9999, h: el.getBoundingClientRect().height })) : null;
  ok(!!top && top.y < top.form && top.h >= 44, 'a „Kérdésed van? Írj nekünk” gomb az oldal tetején, az űrlap előtt (legalább 44 px)');
  // az előrendelő űrlapba beírt név / e-mail átkerül
  await p.type('input#elo-name', 'Kérdező Kata');
  await p.type('input#elo-email', 'kata@pelda.hu');
  await p.click('[data-kerdes-gomb]');
  await p.waitForSelector('[data-kerdes]');
  ok(await p.$eval('#kerdes-name', i => i.value) === 'Kérdező Kata' && await p.$eval('#kerdes-email', i => i.value) === 'kata@pelda.hu', 'a már beírt név és e-mail cím átkerül');
  // üres üzenettel hibát jelez, nem küld
  await p.click('[data-kerdes-kuld]');
  await wait(300);
  ok(!!(await p.$('#hiba-kerdes-message')) && (await smtp.mails()).length === 0, 'üzenet nélkül a mezőnél jelez, nem küld');
  await p.$eval('#kerdes-email', i => { i.focus(); });
  await p.evaluate(() => { const i = document.getElementById('kerdes-email'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.type('#kerdes-message', 'Szia! Mikor lehet átvenni a dobozt?\nKöszi!');
  await p.click('[data-kerdes-kuld]');
  await wait(300);
  ok(!!(await p.$('#hiba-kerdes-email')) && (await smtp.mails()).length === 0, 'e-mail cím nélkül nem küld (kötelező)');
  await p.type('#kerdes-email', 'kata@pelda.hu');
  await p.screenshot({ path: `${SHOTS}elorendeles-kerdes.jpg`, quality: 60, fullPage: true });
  ok((await p.evaluate(() => document.documentElement.scrollWidth)) === 402, 'telefonon nincs vízszintes görgetés');
  await p.click('[data-kerdes-kuld]');
  await p.waitForSelector('[data-kerdes-elkuldve]', { timeout: 20000 }).catch(() => {});
  ok(/kata@pelda\.hu/.test(await p.$eval('[data-kerdes-elkuldve]', el => el.textContent).catch(() => '')), 'visszajelzés: elküldtük, erre a címre válaszolunk');
  const m = await mailFor(x => x.replyTo.includes('kata@pelda.hu'));
  ok(!!m && m.to.includes('bolt@teszt.hu'), `a levél a bolt postafiókjába ment (${m?.to})`);
  ok(!!m && /Kérdés az előrendelésről – Kérdéses ETB \(Kérdező Kata\)/.test(m.subject), `tárgy a termékkel és a névvel (${m?.subject})`);
  ok(!!m && /Mikor lehet átvenni a dobozt\?/.test(m.text) && /kata@pelda\.hu/.test(m.html), 'benne az üzenet és a kérdező címe');
  ok(!(await smtp.mails()).some(x => x.to.includes('kata@pelda.hu')), 'a kérdezőnek nem megy levél (nem lehet vele idegen címre írni)');
  await p.screenshot({ path: `${SHOTS}elorendeles-kerdes-elkuldve.jpg`, quality: 60 });

  // --- Beépítve (a weboldal ablakában) és termék nélküli oldalon is ott van ---
  const e = await page(b, null, 402, 874);
  await e.goto(`${BASE}/elorendeles?termek=${prod}&embed=1`, { waitUntil: 'networkidle2' });
  ok(!!(await e.$('[data-kerdes-gomb]')), 'beépítve is ott a gomb');
  await db.collection('preorder_products').updateOne({ _id: (await db.collection('preorder_products').findOne({ name: 'Kérdéses ETB' }))._id }, { $set: { isOpen: false } });
  const n = await page(b, null);
  await n.goto(`${BASE}/elorendeles`, { waitUntil: 'networkidle2' });
  ok(!!(await n.$('[data-kerdes-gomb]')) && /nincs nyitott előrendelés/.test(await n.evaluate(() => document.body.innerText)), 'nyitott előrendelés nélkül is lehet írni');

  // --- korlát: e-mail címenként óránként 5 ---
  const codes = [];
  for (let i = 0; i < 6; i++) codes.push((await post({ name: 'Sok', email: 'sok@pelda.hu', message: `Kérdés ${i}` })).status);
  ok(codes.slice(0, 5).every(c => c === 200) && codes[5] === 429, `ugyanarról a címről óránként legfeljebb 5 üzenet (${codes.join(',')})`);
  console.log('  böngészőhibák:', [...p.errs, ...e.errs, ...n.errs].join(' | ') || 'nincs');
} finally {
  await b.close(); await smtp.close(); await client.close(); summary();
}
