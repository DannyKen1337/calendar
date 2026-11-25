// Telefonos értesítések (lib/push.js) memóriabeli MongoDB-vel és ál-küldővel (a teszt nem küld valódi pusht):
// csak az ismert push-szolgáltatók címét fogadja el, a VAPID kulcspár egyszer jön létre, mindenki csak a sajátját kezeli,
// a megszűnt feliratkozás (410) törlődik, a többi hiba nem.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { MongoClient } from 'mongodb';
import { validSubscription, vapidKeys, subscribe, unsubscribe, pushToUser, SUBS } from './push.js';

let mongod; let client; let db;
const keys = { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) };
const fcm = (n) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/eszkoz-${n}`, keys });
const apple = { endpoint: 'https://web.push.apple.com/QGuQyavXutnMH', keys };

before(async () => { mongod = await MongoMemoryServer.create(); client = await MongoClient.connect(mongod.getUri()); db = client.db('teszt'); });
after(async () => { await client?.close(); await mongod?.stop(); });

test('csak az ismert push-szolgáltatók https címe', () => {
  assert.ok(validSubscription(fcm(1)));
  assert.ok(validSubscription(apple));
  assert.ok(validSubscription({ endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/x', keys }));
  assert.equal(validSubscription({ endpoint: 'http://fcm.googleapis.com/fcm/send/x', keys }), null, 'http nem');
  assert.equal(validSubscription({ endpoint: 'https://gonosz.example.com/push', keys }), null, 'idegen cím nem');
  assert.equal(validSubscription({ endpoint: 'https://fcm.googleapis.com.gonosz.hu/x', keys }), null, 'álcázott cím nem');
  assert.equal(validSubscription({ endpoint: fcm(1).endpoint, keys: { p256dh: 'rossz', auth: 'x' } }), null, 'hibás kulcs nem');
  assert.equal(validSubscription(null), null);
});

test('a VAPID kulcspár egyszer jön létre', async () => {
  const [a, b] = await Promise.all([vapidKeys(db), vapidKeys(db)]);
  assert.ok(a.publicKey && a.privateKey);
  assert.equal(a.publicKey, b.publicKey);
  assert.equal((await vapidKeys(db)).publicKey, a.publicKey);
});

test('feliratkozás, leiratkozás csak a sajátra, küldés, megszűnt eszköz törlése', async () => {
  assert.ok((await subscribe(db, 'u1', fcm(1), 'Android')).ok);
  assert.ok((await subscribe(db, 'u1', apple, 'iPhone')).ok);
  assert.ok((await subscribe(db, 'u2', fcm(2))).ok);
  assert.ok((await subscribe(db, 'u1', fcm(1))).ok, 'ugyanaz az eszköz kétszer: egy sor');
  assert.equal(await db.collection(SUBS).countDocuments({ userId: 'u1' }), 2);
  assert.ok((await subscribe(db, 'u1', { endpoint: 'https://x.example.com/', keys })).error);

  await unsubscribe(db, 'u2', fcm(1).endpoint); // más eszközét nem veheti ki
  assert.equal(await db.collection(SUBS).countDocuments({ userId: 'u1' }), 2);

  const calls = [];
  const send = async (sub, body, opts) => {
    calls.push({ sub, body: JSON.parse(body), opts });
    if (sub.endpoint === apple.endpoint) throw Object.assign(new Error('Gone'), { statusCode: 410 });
  };
  const n = await pushToUser(db, 'u1', { title: 'Válasz érkezett', body: 'Kiss Anna válaszolt (ETB)', url: '/admin/uzenetek?szal=1', tag: 'szal-1' }, { subject: 'https://taverncalendar.vercel.app', send });
  assert.equal(n, 1, 'egy eszközre ment ki');
  assert.equal(calls.length, 2, 'mindkét eszközre megpróbálta');
  assert.deepEqual(calls[0].body, { title: 'Válasz érkezett', body: 'Kiss Anna válaszolt (ETB)', url: '/admin/uzenetek?szal=1', tag: 'szal-1' });
  assert.equal(calls[0].opts.vapidDetails.publicKey, (await vapidKeys(db)).publicKey);
  assert.equal(calls[0].opts.vapidDetails.subject, 'https://taverncalendar.vercel.app');
  assert.equal(await db.collection(SUBS).countDocuments({ userId: 'u1' }), 1, 'a megszűnt (410) eszköz törölve');

  // más hiba (pl. hálózat): marad
  await pushToUser(db, 'u1', { title: 'x' }, { send: async () => { throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }); } });
  assert.equal(await db.collection(SUBS).countDocuments({ userId: 'u1' }), 1);
  assert.equal(await pushToUser(db, 'senki', { title: 'x' }, { send }), 0, 'feliratkozás nélkül semmi');
  await unsubscribe(db, 'u1', fcm(1).endpoint);
  assert.equal(await db.collection(SUBS).countDocuments({ userId: 'u1' }), 0);
});
