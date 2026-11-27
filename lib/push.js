// Telefonos (web push) értesítések a szervezőknek: most az új válaszról egy szervezői üzenetre (lib/messages.js notifyWriter).
// Eszközönként iratkoznak fel az adminban (Továbbiak › Fiók › Értesítések, components/PushToggle.jsx); a feliratkozás a
// push_subscriptions gyűjteményben van: { _id: endpoint, userId, keys: { p256dh, auth }, ua, createdAt }.
// iPhone-on csak a kezdőképernyőre tett admin webappban működik (iOS 16.4+), Androidon és gépen a böngészőben is.
// A VAPID kulcspárt a rendszer első használatkor maga hozza létre és az adatbázisban tartja (settings.push_vapid),
// így nem kell környezeti változó. Tiszta modul (nincs „@/” import): lib/push.test.mjs teszteli, cserélhető küldővel.
import { generateVAPIDKeys, sendNotification } from 'web-push';
import { isTestEnv } from './testEnv.js';

export const SUBS = 'push_subscriptions';
const KEYS = 'push_vapid';

// Csak az ismert push-szolgáltatók címei (a szerver ezekre küld; más címet nem fogadunk el)
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/, /^push\.services\.mozilla\.com$/];
export function validSubscription(sub) {
  if (!sub || typeof sub !== 'object') return null;
  let url;
  try { url = new URL(String(sub.endpoint || '')); } catch { return null; }
  if (url.protocol !== 'https:' || !PUSH_HOSTS.some(re => re.test(url.hostname)) || url.href.length > 1000) return null;
  const p256dh = String(sub.keys?.p256dh || ''); const auth = String(sub.keys?.auth || '');
  if (!/^[A-Za-z0-9_-]{40,200}$/.test(p256dh) || !/^[A-Za-z0-9_-]{10,100}$/.test(auth)) return null;
  return { endpoint: url.href, keys: { p256dh, auth } };
}

// A VAPID kulcspár (első használatkor létrehozva; párhuzamos létrehozásnál az elsőként mentett marad)
export async function vapidKeys(db) {
  const settings = db.collection('settings');
  const found = await settings.findOne({ _id: KEYS });
  if (found?.publicKey && found?.privateKey) return found;
  const keys = generateVAPIDKeys();
  try { await settings.insertOne({ _id: KEYS, ...keys, createdAt: new Date() }); } catch { /* közben létrejött */ }
  return settings.findOne({ _id: KEYS });
}

export async function subscribe(db, userId, sub, ua = '') {
  const s = validSubscription(sub);
  if (!s) return { error: 'Érvénytelen feliratkozás.' };
  await db.collection(SUBS).updateOne({ _id: s.endpoint }, { $set: { userId: String(userId), keys: s.keys, ua: String(ua).slice(0, 200), updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  return { ok: true, endpoint: s.endpoint };
}

export async function unsubscribe(db, userId, endpoint) {
  await db.collection(SUBS).deleteOne({ _id: String(endpoint || ''), userId: String(userId) });
}

// Értesítés egy felhasználó minden feliratkozott eszközére. payload: { title, body, url, tag }
// A megszűnt feliratkozást (404 / 410) törli. send: a teszthez cserélhető (alapból web-push).
// subject: a VAPID kapcsolattartó (a naptár címe). Visszaad: hány eszközre ment ki.
export async function pushToUser(db, userId, payload, { subject, send = sendNotification } = {}) {
  if (isTestEnv()) return 0; // a tesztkörnyezetből nem megy értesítés a valódi eszközökre
  const subs = await db.collection(SUBS).find({ userId: String(userId) }).toArray();
  if (!subs.length) return 0;
  const keys = await vapidKeys(db);
  const body = JSON.stringify({ title: String(payload.title || 'Tavern Admin').slice(0, 120), body: String(payload.body || '').slice(0, 300), url: String(payload.url || '/admin'), tag: payload.tag ? String(payload.tag).slice(0, 80) : undefined });
  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await send({ endpoint: s._id, keys: s.keys }, body, { TTL: 24 * 3600, urgency: 'high', vapidDetails: { subject: subject || process.env.APP_URL || 'https://www.tavern.hu', publicKey: keys.publicKey, privateKey: keys.privateKey } });
      sent += 1;
    } catch (err) {
      if (err?.statusCode === 404 || err?.statusCode === 410) await db.collection(SUBS).deleteOne({ _id: s._id });
      else console.error('push küldés:', err?.statusCode || err?.message || err);
    }
  }));
  return sent;
}
