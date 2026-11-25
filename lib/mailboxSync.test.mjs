// A rendszer postafiókjának olvasása (lib/mailboxRead.js + lib/mailboxSync.js) ál-IMAP klienssel és memóriabeli MongoDB-vel:
// a szál „+” címére jött levél a szál válasza lesz (idézett előzmény nélkül, olvasatlan), minden levél bekerül a Beérkezett
// levelek közé, a második olvasás csak az újakat nézi, és ugyanaz a levél nem kerül be kétszer.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync, statSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { MongoClient } from 'mongodb';

// a lib fájlok „@/lib/…” importjai a projekt gyökeréhez (mint a Next.js-ben)
const ROOT = fileURLToPath(new URL('..', import.meta.url));
registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) {
      const base = ROOT + spec.slice(2);
      const file = ['', '.js', '.jsx'].map(e => base + e).find(f => existsSync(f) && statSync(f).isFile()) || `${base}.js`;
      return next(pathToFileURL(file).href, ctx);
    }
    return next(spec, ctx);
  },
});

const TOKEN = '0123456789abcdef01234567';
let mongod; let client; let db; let sync;

const raw = ({ from, to, subject, body, id }) => Buffer.from([
  `From: ${from}`, `To: ${to}`, `Subject: ${subject}`, `Message-ID: <${id}>`, 'Date: Wed, 25 Nov 2026 10:20:00 +0100',
  'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: 8bit', '', body,
].join('\r\n'));

// Ál-IMAP kliens: a postafiók levelei UID szerint; a „N:*” keresés úgy viselkedik, mint az igazi (az utolsót mindig adja)
function fakeImap(mails) {
  return {
    mailbox: { uidValidity: 7n, uidNext: Math.max(0, ...mails.map(m => m.uid)) + 1 },
    getMailboxLock: async () => ({ release() {} }),
    async search(q) {
      const all = mails.map(m => m.uid);
      if (q.since) return all;
      const from = Number(String(q.uid).split(':')[0]);
      const hit = all.filter(u => u >= from);
      return hit.length ? hit : all.slice(-1);
    },
    async *fetch(uids) {
      for (const m of mails.filter(x => uids.includes(x.uid))) yield { uid: m.uid, size: m.source.length, envelope: m.envelope };
    },
    async fetchOne(uid) { const m = mails.find(x => String(x.uid) === uid); return { uid: m.uid, source: m.source }; },
    async logout() {},
  };
}
const mail = (uid, { from, fromName, to, subject, body }) => ({
  uid,
  envelope: { messageId: `<m${uid}@teszt>`, subject, date: new Date('2026-11-25T09:20:00Z'), from: [{ name: fromName, address: from }], to: [{ name: '', address: to }] },
  source: raw({ from: `${fromName} <${from}>`, to, subject, body, id: `m${uid}@teszt` }),
});

before(async () => {
  mongod = await MongoMemoryServer.create();
  Object.assign(process.env, {
    MONGODB_URI: mongod.getUri(), SMTP_HOST: 'smtp.gmail.com', SMTP_USER: 'tavern.naptar@gmail.com', SMTP_PASS: 'x',
    RESEND_API_KEY: '', MAIL_REPLY_DOMAIN: '',
  });
  client = await MongoClient.connect(mongod.getUri());
  db = client.db('teszt');
  sync = await import('./mailboxSync.js');
  // a szál írója nincs a felhasználók között: értesítő levél nem megy (a teszt nem küld levelet)
  await db.collection('message_threads').insertOne({ kind: 'preorder', refId: 'x', context: 'ETB előrendelés', toName: 'Kiss Anna', toEmail: 'anna@example.com', createdById: 'nincs', createdBy: 'Szervező', token: TOKEN, unread: false, messages: [], lastAt: new Date() });
});
after(async () => {
  await client?.close();
  await (await (await import('./mongodb.js')).default).close(); // a lib/mongodb.js saját kapcsolata
  await mongod?.stop();
});

test('a postafiók olvasása: válasz a szálba, minden levél a Beérkezett levelek közé', async () => {
  assert.equal(sync.mailboxOn(), true, 'Gmail SMTP mellett magától él (imap.gmail.com)');
  const box = [
    mail(5, { from: 'anna@example.com', fromName: 'Kiss Anna', to: `tavern.naptar+valasz-${TOKEN}@gmail.com`, subject: 'Re: ETB', body: 'Köszi, holnap megyek érte!\n\n2026. nov. 25., Sze 10:15 dátummal Tavern Naptár <\ntavern.naptar+valasz-x@gmail.com> ezt írta:\n\n> Megjött az ETB.' }),
    mail(6, { from: 'bolt@example.com', fromName: 'Nagyker', to: 'tavern.naptar@gmail.com', subject: 'Szállítás', body: 'Holnap jön a csomag.' }),
  ];
  const res = await sync.syncMailbox(db, 'http://x', { minGapMs: 0, connect: async () => fakeImap(box) });
  assert.deepEqual(res, { stored: 2, replies: 1 });

  const th = await db.collection('message_threads').findOne({ token: TOKEN });
  assert.equal(th.messages.length, 1);
  assert.equal(th.messages[0].dir, 'in');
  assert.equal(th.messages[0].text, 'Köszi, holnap megyek érte!', 'az idézett előzmény levágva');
  assert.equal(th.unread, true);

  const inbox = await db.collection('inbox_mails').find().sort({ uid: 1 }).toArray();
  assert.equal(inbox.length, 2);
  assert.equal(inbox[0].threadId, String(th._id), 'a válasz meg van jelölve');
  assert.match(inbox[0].text, /ezt írta/, 'a Beérkezett levelekben a teljes levél látszik');
  assert.equal(inbox[1].from.address, 'bolt@example.com');
  assert.equal(inbox[1].subject, 'Szállítás');
  assert.equal(inbox[1].threadId, undefined);

  // második olvasás: semmi új (az „N:*” a régi utolsót is visszaadja, de az nem kerül be újra)
  const again = await sync.syncMailbox(db, 'http://x', { minGapMs: 0, connect: async () => fakeImap(box) });
  assert.deepEqual(again, { stored: 0, replies: 0 });
  assert.equal((await db.collection('message_threads').findOne({ token: TOKEN })).messages.length, 1);

  // új levél jön: csak az kerül be
  box.push(mail(7, { from: 'anna@example.com', fromName: 'Kiss Anna', to: `tavern.naptar+valasz-${TOKEN}@gmail.com`, subject: 'Re: ETB', body: 'Mégis csak pénteken.' }));
  const third = await sync.syncMailbox(db, 'http://x', { minGapMs: 0, connect: async () => fakeImap(box) });
  assert.deepEqual(third, { stored: 1, replies: 1 });
  assert.equal((await db.collection('message_threads').findOne({ token: TOKEN })).messages.at(-1).text, 'Mégis csak pénteken.');

  // percenként legfeljebb egyszer
  assert.ok((await sync.syncMailbox(db, 'http://x', { connect: async () => fakeImap(box) })).skipped);
  const st = await sync.mailboxStatus(db);
  assert.equal(st.on, true); assert.equal(st.error, null); assert.ok(st.at);
});

test('hibás belépés: a hiba látszik az állapotban, és nem akad be a zár', async () => {
  const bad = await sync.syncMailbox(db, 'http://x', { minGapMs: 0, connect: async () => { throw Object.assign(new Error('Invalid credentials'), { responseText: 'Invalid credentials (Failure)' }); } });
  assert.match(bad.error, /Invalid credentials/);
  assert.match((await sync.mailboxStatus(db)).error, /Invalid credentials/);
  const ok = await sync.syncMailbox(db, 'http://x', { minGapMs: 0, connect: async () => fakeImap([]) });
  assert.deepEqual(ok, { stored: 0, replies: 0 });
  assert.equal((await sync.mailboxStatus(db)).error, null);
});
