// Tesztkörnyezet (a weblap-szerkesztes ág előnézete a Vercelen, saját, nem nyilvános vercel.app címen; TEST_ENV=1).
// A régi taverncalendar.vercel.app cím az élő oldalé marad, így a régi linkekkel senki nem jut a tesztbe.
// - Csak a TEST_USERS-ben felsorolt fiókok léphetnek be (vesszővel elválasztva, kis/nagybetű nem számít), és csak
//   belépve látható bármi; aki nincs belépve, azt a proxy az élő oldal ugyanazon címére küldi.
// - Saját adatbázis (MONGODB_DB, pl. TavernTeszt; az éles „Tavern” adatbázisra nem kapcsolódik: lib/mongodb.js).
// - Nem megy ki levél valódi címzettnek (TEST_MAIL_TO-ra megy, vagy sehova), telefonos értesítés és postafiók-olvasás nincs.
import { jwtVerify } from 'jose';

export const LIVE_URL = 'https://www.tavern.hu';
export const LIVE_DB = 'Tavern';

export const isTestEnv = (env = process.env) => env.TEST_ENV === '1';
// A saját gépen futó tesztkörnyezet (scripts/teszt-inditas.*): belépés nélkül a belépőre visz, nem az élő oldalra
export const isLocalTest = (env = process.env) => isTestEnv(env) && env.TEST_LOCAL === '1';
export const testUsers = (env = process.env) => String(env.TEST_USERS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
export const isTestUser = (username, env = process.env) => !!username && testUsers(env).includes(String(username).trim().toLowerCase());

// Belépés nélkül is elérhető: a belépő oldal, a belépés, és a másolat kérése (az maga ellenőrzi a tulajdonost vagy a
// beállító kulcsot: app/api/test-env); a többi az élő oldalra irányít
export const testOpenPath = (pathname) => pathname === '/admin' || pathname === '/admin/' || pathname === '/api/auth' || pathname.startsWith('/api/auth/') || pathname === '/api/test-env' || pathname === '/_nem-talalhato';

// Az élő oldal megfelelő címe (a régi vercel.app gyökér a naptár volt: /naptar)
export function liveUrlFor(url) {
  const u = new URL(url);
  return `${LIVE_URL}${u.pathname === '/' ? '/naptar' : u.pathname}${u.search}`;
}

// A belépési süti felhasználóneve, ha érvényes és a tesztfiókok között van (különben null)
export async function testSessionUser(sessionCookie, env = process.env) {
  if (!sessionCookie || !env.JWT_SECRET) return null;
  try {
    const { payload } = await jwtVerify(sessionCookie, new TextEncoder().encode(env.JWT_SECRET), { algorithms: ['HS256'] });
    return isTestUser(payload?.username, env) ? String(payload.username) : null;
  } catch {
    return null;
  }
}

// A tesztben kimenő levél: csak a TEST_MAIL_TO címre megy (a tárgyban az eredeti címzettel); ha nincs megadva, sehova
export function testMailTarget(to, subject, env = process.env) {
  const target = String(env.TEST_MAIL_TO || '').trim();
  if (!target) return null;
  return { to: target, subject: `[TESZT → ${Array.isArray(to) ? to.join(', ') : to}] ${subject || ''}` };
}
