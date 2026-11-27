// Heti takarítás Google Drive-mentéssel: a törlés előtt minden törlendő adat (régi események a jelentkezőkkel, lejárt
// előrendelések, egy évnél régebbi levelek, üzenetszálak, naplóbejegyzések) egy JSON-fájlba kerül a Drive-on
// („Tavern naptár – mentések” mappa). Ha a mentés nem sikerül, semmi nem törlődik. A Rendszer oldal „Mentés most”
// gombja a teljes adatbázist menti (jelszavak nélkül). Hamis Google-szerverrel (tests/e2e/fake-gdrive.mjs).
import { openDb, token, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';
import { startGdrive } from './fake-gdrive.mjs';

const { client, db } = await openDb();
const owner = (await db.collection('users').insertOne({ username: 'MentoTulaj', email: 'mt@x.hu', password: 'titkos-hash-123', role: 'owner', lastSeenChangelog: '9999' })).insertedId;
const tok = await token(owner, 'MentoTulaj', 'owner');
const ago = (months) => { const d = new Date(); d.setMonth(d.getMonth() - months); return d; };
const day = (d) => d.toISOString().slice(0, 10);

const oldEv = (await db.collection('tournaments').insertOne({ name: 'Régi verseny', date: `${day(ago(4))}T18:00`, category: 'Pokémon TCG', store: 'debrecen', max_players: 8, current_players: 1, is_open: false })).insertedId;
const newEv = (await db.collection('tournaments').insertOne({ name: 'Friss verseny', date: `${day(ago(0))}T18:00`, category: 'Pokémon TCG', store: 'debrecen', max_players: 8, current_players: 0, is_open: true })).insertedId;
await db.collection('registrations').insertOne({ tournamentId: String(oldEv), tournamentName: 'Régi verseny', username: 'Regi', name: 'Régi Rudolf', email: 'rudolf@pelda.hu', status: 'Aktív', date: ago(4) });
await db.collection('inbox_mails').insertMany([
  { _id: '<regi@teszt>', from: { address: 'a@pelda.hu' }, subject: 'Régi levél', date: ago(13), text: 'régi' },
  { _id: '<uj@teszt>', from: { address: 'b@pelda.hu' }, subject: 'Új levél', date: ago(1), text: 'új' },
]);
await db.collection('message_threads').insertMany([{ toName: 'Régi szál', lastAt: ago(14), messages: [] }, { toName: 'Új szál', lastAt: ago(2), messages: [] }]);
await db.collection('audit_logs').insertMany([{ adminName: 'x', action: 'RÉGI NAPLÓ', details: 'régi', date: ago(13) }, { adminName: 'x', action: 'ÚJ NAPLÓ', details: 'új', date: ago(1) }]);
const prod = (await db.collection('preorder_products').insertOne({ name: 'Lejárt doboz', category: 'Pokémon TCG', isOpen: false, closedAt: ago(7), perPersonLimit: 0 })).insertedId;
await db.collection('preorders').insertOne({ productId: String(prod), name: 'Elő Ede', email: 'ede@pelda.hu', phone: '+36 30 999 9999', quantity: 1, date: ago(8) });

const cron = () => fetch(`${BASE}/api/cron/cleanup`, { headers: { Authorization: 'Bearer e2e-cron-titok' } });
const gd = await startGdrive();
const b = await browser();
try {
  // 1. a mentés nem sikerül: semmi nem törlődik
  gd.state.mode = 'fail-upload';
  const r1 = await cron();
  ok(r1.status === 500, `sikertelen mentésnél a takarítás hibával áll le (${r1.status})`);
  ok(!!(await db.collection('tournaments').findOne({ _id: oldEv })) && !!(await db.collection('inbox_mails').findOne({ _id: '<regi@teszt>' })) && !!(await db.collection('preorders').findOne({ name: 'Elő Ede' })), 'semmi nem törlődött');
  const run1 = await db.collection('system_runs').findOne({ job: 'cleanup' }, { sort: { at: -1 } });
  ok(run1 && !run1.ok && /feltöltés nem sikerült/i.test(run1.error || ''), `a hiba a Rendszer oldalra kerül (${run1?.error})`);

  // 2. a mentés sikerül: előbb ment, utána töröl
  gd.state.mode = 'ok';
  const r2 = await cron();
  const j2 = await r2.json();
  ok(r2.status === 200 && /^tavern-takaritas-\d{4}-\d{2}-\d{2}\.json$/.test(j2.backup?.name || ''), `mentés a Drive-ra (${j2.backup?.name})`);
  const f = gd.state.files[0];
  ok(gd.state.folders.length === 1 && gd.state.folders[0].name === 'Tavern naptár – mentések' && f?.parent === gd.state.folders[0].id, 'a program saját mappájába');
  const c = f?.content || {};
  ok(c.tournaments?.some(t => t.name === 'Régi verseny') && c.registrations?.some(r => r.email === 'rudolf@pelda.hu') && c.preorders?.some(p => p.name === 'Elő Ede') && c.preorderProducts?.some(p => p.name === 'Lejárt doboz'), 'a mentésben a régi esemény a jelentkezőjével és a lejárt előrendelés');
  ok(c.inboxMails?.length === 1 && c.inboxMails[0].subject === 'Régi levél' && c.messageThreads?.length === 1 && c.auditLogs?.some(l => l.action === 'RÉGI NAPLÓ') && !c.tournaments?.some(t => t.name === 'Friss verseny'), 'csak a 12 hónapnál régebbi levél, szál és napló (és a friss esemény nem)');
  ok(!(await db.collection('tournaments').findOne({ _id: oldEv })) && !(await db.collection('registrations').findOne({ email: 'rudolf@pelda.hu' })) && !(await db.collection('preorders').findOne({ name: 'Elő Ede' })), 'mentés után a régi adatok törlődtek');
  ok(!(await db.collection('inbox_mails').findOne({ _id: '<regi@teszt>' })) && !!(await db.collection('inbox_mails').findOne({ _id: '<uj@teszt>' })) && (await db.collection('message_threads').countDocuments()) === 1 && !(await db.collection('audit_logs').findOne({ action: 'RÉGI NAPLÓ' })) && !!(await db.collection('audit_logs').findOne({ action: 'ÚJ NAPLÓ' })), '12 hónap: a régi levél, szál, napló törlődött, az új megmaradt');
  ok(!!(await db.collection('tournaments').findOne({ _id: newEv })), 'a friss esemény megmaradt');
  ok(!!(await db.collection('audit_logs').findOne({ action: 'AUTOMATA TAKARÍTÁS', details: /Google Drive-ra: tavern-takaritas-/ })), 'a naplóban: mit törölt, és hova mentette');

  // 3. nincs mit törölni: nincs új mentés
  const before = gd.state.files.length;
  await cron();
  ok(gd.state.files.length === before, 'ha nincs mit törölni, nem készül fölösleges mentés');

  // 4. „Mentés most”: teljes adatbázis, jelszavak nélkül; a meglévő mappába
  const r4 = await fetch(`${BASE}/api/admin-backup`, { method: 'POST', headers: { Cookie: `tavern_session=${tok}` } });
  const j4 = await r4.json();
  const full = gd.state.files.at(-1);
  ok(r4.status === 200 && /^tavern-teljes-mentes-/.test(j4.name) && full.parent === gd.state.folders[0].id, `teljes mentés a meglévő mappába (${j4.name})`);
  ok(full.content.users?.some(u => u.username === 'MentoTulaj') && !JSON.stringify(full.content).includes('titkos-hash-123') && Array.isArray(full.content.inboxMails), 'a teljes mentésben minden benne van, a jelszó nem');

  // 5. a mappát törölték: újat hoz létre
  gd.state.mode = 'lost-folder';
  const r5 = await fetch(`${BASE}/api/admin-backup`, { method: 'POST', headers: { Cookie: `tavern_session=${tok}` } });
  ok(r5.status === 200 && gd.state.folders.length === 2 && gd.state.files.at(-1).parent === 'mappa2', 'ha a mappát törölték, újat hoz létre');

  // 6. lejárt engedély: érthető hiba
  gd.state.mode = 'bad-token';
  const r6 = await fetch(`${BASE}/api/admin-backup`, { method: 'POST', headers: { Cookie: `tavern_session=${tok}` } });
  ok(r6.status === 502 && /engedély lejárt/.test((await r6.json()).error || ''), 'lejárt Google-engedélynél érthető hibaüzenet');

  // Rendszer oldal: állapot, utolsó mentés, hiba
  gd.state.mode = 'ok';
  const p = await page(b, tok);
  await p.goto(`${BASE}/admin/rendszer`, { waitUntil: 'networkidle2', timeout: 240000 });
  await p.waitForSelector('[data-drive-mentes]', { timeout: 30000 }).catch(() => {});
  const panelText = await p.$eval('[data-drive-mentes]', el => el.textContent).catch(() => '');
  ok(/engedély lejárt/.test(panelText) && /tavern-teljes-mentes-/.test(panelText), 'a Rendszer oldalon az utolsó mentés és a hiba');
  await p.click('[data-drive-most]');
  await p.waitForFunction(() => !/engedély lejárt/.test(document.querySelector('[data-drive-mentes]')?.textContent || ''), { timeout: 20000 }).catch(() => {});
  ok(!/engedély lejárt/.test(await p.$eval('[data-drive-mentes]', el => el.textContent)), '„Mentés most” gombbal ment, és a hiba eltűnik');
  await p.screenshot({ path: `${SHOTS}takaritas-mentes.jpg`, quality: 60, fullPage: true });
  console.log('  böngészőhibák:', p.errs.join(' | ') || 'nincs');
} finally {
  await b.close(); await gd.close(); await client.close(); summary();
}
