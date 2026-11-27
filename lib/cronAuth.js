// Az időzített feladatok (/api/cron/*) kulcsának ellenőrzése: Authorization: Bearer <CRON_SECRET>. Állandó idejű
// összehasonlítással (a válaszidőből ne lehessen a kulcsot karakterenként kitalálni); kulcs nélkül soha nem enged át.
import { createHash, timingSafeEqual } from 'node:crypto';

const digest = (s) => createHash('sha256').update(String(s)).digest();

export function isCronAuthorized(request, secret = process.env.CRON_SECRET) {
  if (!secret) return false;
  const given = request.headers.get('authorization') || '';
  return timingSafeEqual(digest(given), digest(`Bearer ${secret}`));
}
