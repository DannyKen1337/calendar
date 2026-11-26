// Belépési zárolások (jelszópróbálgatás ellen) és feloldásuk. A próbálkozások a rate_limits gyűjteményben vannak:
//  - login:<ip>          minden belépési kísérlet, IP-nként 20 / 15 perc
//  - login-fail:<név>    a hibás jelszavak a beírt felhasználónévre / e-mail címre, 10 / 15 perc (az IP-vel együtt)
// A tulajdonos a Felhasználók oldalon feloldhatja: a fiók hibás próbálkozásai és azoknak a gépeknek (IP) a kísérletei
// törlődnek, ahonnan a hibás próbálkozások jöttek, így a felhasználó azonnal újra próbálkozhat.
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const FAIL_LIMIT = 10;
export const IP_LIMIT = 20;

export const ipKey = (ip) => `login:${ip}`;
export const failKey = (loginId) => `login-fail:${String(loginId || '').trim().toLowerCase()}`;
const userKeys = (user) => [...new Set([user?.username, user?.email].filter(Boolean).map(failKey))];

const counts = async (db, regex, limit) => {
  const rows = await db.collection('rate_limits').aggregate([
    { $match: { key: { $regex: regex }, at: { $gte: new Date(Date.now() - LOGIN_WINDOW_MS) } } },
    { $group: { _id: '$key', count: { $sum: 1 }, until: { $min: '$at' } } },
    { $match: { count: { $gte: limit } } },
  ]).toArray();
  return rows;
};

// Most zárolt fiókazonosítók (failKey-ek) és gépek: { failKeys: Set, ips: [{ ip, count }] }
export async function currentLocks(db) {
  const [fails, ips] = await Promise.all([counts(db, '^login-fail:', FAIL_LIMIT), counts(db, '^login:', IP_LIMIT)]);
  return { failKeys: new Set(fails.map(r => r._id)), ips: ips.map(r => ({ ip: r._id.slice('login:'.length), count: r.count })) };
}

export const isUserLocked = (locks, user) => userKeys(user).some(k => locks.failKeys.has(k));

// Egy fiók feloldása: a hibás próbálkozásai és az érintett gépek kísérletei törlődnek. Visszaadja, hány sor törlődött.
export async function unlockUser(db, user) {
  const col = db.collection('rate_limits');
  const keys = userKeys(user);
  const ips = (await col.distinct('ip', { key: { $in: keys } })).filter(Boolean);
  const res = await col.deleteMany({ $or: [{ key: { $in: keys } }, ...(ips.length ? [{ key: { $in: ips.map(ipKey) } }] : [])] });
  return res.deletedCount;
}

// Minden belépési zárolás feloldása (pl. ha a bolt gépéről sokan léptek be, és az IP zárolódott)
export async function unlockAll(db) {
  return (await db.collection('rate_limits').deleteMany({ key: { $regex: '^login(-fail)?:' } })).deletedCount;
}
