// CSRF elleni védelem: az API-ra írási kérés (POST, PUT, PATCH, DELETE) csak a saját címünkről jöhet.
// A böngésző minden ilyen kéréshez elküldi az Origin fejlécet; ha az idegen (pl. egy tavern.hu aldomain vagy más oldal),
// a kérést elutasítjuk, még a süti ellenőrzése előtt. Origin nélkül (szerver–szerver hívás: Resend webhook, időzítő,
// curl) nem jön süti sem, ezért azt átengedjük: ott a végpont saját ellenőrzése (aláírás, titkos kulcs) véd.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function isCrossOriginWrite({ method, origin, host }) {
  if (SAFE_METHODS.has(String(method || 'GET').toUpperCase())) return false;
  if (origin == null || origin === '') return false;
  if (origin === 'null') return true; // sandbox-olt iframe, file:// stb.
  let originHost;
  try { originHost = new URL(origin).host; } catch { return true; }
  return !host || originHost.toLowerCase() !== String(host).toLowerCase();
}
