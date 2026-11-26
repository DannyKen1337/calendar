// Rejtett admin: ha az ADMIN_PATH környezeti változó meg van adva (pl. "/ajto-8f2k3m9q"), az admin felület, a weboldal
// szerkesztője és a belépés csak annak érhető el, aki egyszer megnyitotta ezt a titkos címet (kap egy „kapu” sütit), vagy
// már be van lépve. Mindenki más 404-et kap, mintha ezek az oldalak nem is léteznének: a robotok nem találják meg a belépő
// oldalt, és jelszót sem próbálgathatnak. Az oldalak címe változatlan (/admin), így a linkek, az értesítések és a telefonos
// webapp is működik. ADMIN_PATH nélkül minden a régi (fejlesztés, tesztek, amíg nincs beállítva).
// A sütiben a titkos címből és a JWT_SECRET-ből számolt HMAC van: az ADMIN_PATH cseréjével minden régi kapu-süti érvénytelen.
import { jwtVerify } from 'jose';

export const GATE_COOKIE = 'tavern_kapu';
export const GATE_MAX_AGE = 400 * 24 * 3600; // a böngészők legfeljebb 400 napig engednek sütit

// Kapu mögött: az admin oldalai, a weboldal szerkesztője és előnézete
const GATED_PAGES = [/^\/admin(\/|$)/, /^\/weblapteszt\/admin(\/|$)/, /^\/weblapteszt\/elonezet(\/|$)/];

// A titkos cím: legalább 8 karakter, csak betű, szám, kötőjel (pl. "/ajto-8f2k3m9q"); hibás értéknél a kapu ki van kapcsolva
export function adminPath(env = process.env) {
  const raw = String(env.ADMIN_PATH || '').trim().replace(/\/+$/, '');
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return /^\/[A-Za-z0-9-]{8,64}$/.test(path) && !/^\/admin/i.test(path) ? path : null;
}

export const isGatedPage = (pathname) => GATED_PAGES.some(re => re.test(pathname));
// A belépés (jelszó, regisztráció, első jelszóbeállítás) is a kapu mögött van; a munkamenet lekérdezése és a kilépés nem
export const isGatedApi = (pathname, method) => pathname === '/api/auth' && String(method).toUpperCase() === 'POST';

const secretKey = (env) => new TextEncoder().encode(env.JWT_SECRET || (env.NODE_ENV === 'production' ? '' : 'dev_only_jwt_secret_not_for_production'));

export async function gateToken(path, env = process.env) {
  const key = await crypto.subtle.importKey('raw', secretKey(env), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`admin-kapu:${path}`)));
  return btoa(String.fromCharCode(...sig)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Állandó idejű összehasonlítás (a süti értékéből ne lehessen időméréssel kitalálni a helyeset)
function sameString(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Átengedjük-e: érvényes kapu-süti, vagy érvényes belépési süti (aki már be van lépve, azt nem zárjuk ki)
export async function passesGate({ gateCookie, sessionCookie, path, env = process.env }) {
  if (gateCookie && sameString(gateCookie, await gateToken(path, env))) return true;
  if (sessionCookie) {
    try {
      await jwtVerify(sessionCookie, secretKey(env), { algorithms: ['HS256'] });
      return true;
    } catch { /* lejárt vagy hamis süti */ }
  }
  return false;
}
