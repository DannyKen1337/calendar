// A szervezői üzenetek tiszta segédfüggvényei (szerveroldalon, tesztelhetők): a válaszcím, a beérkező levél tisztítása
// és a Resend (Svix) webhook aláírásának ellenőrzése.
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

// A válaszcím helyi része: valasz-<token>@<MAIL_REPLY_DOMAIN>. A token szálanként egyedi, nem kitalálható.
export const newReplyToken = () => randomBytes(12).toString('hex');
export const replyAddress = (token, domain) => `valasz-${token}@${domain}`;

// A beérkező levél címzettjei közül a szál tokenje (a "Név <cím>" alak is jó)
export function replyTokenFrom(addresses) {
  for (const a of (Array.isArray(addresses) ? addresses : [addresses]).filter(Boolean)) {
    const m = String(a).toLowerCase().match(/valasz-([0-9a-f]{24})@/);
    if (m) return m[1];
  }
  return null;
}

// A HTML levél szövege (ha nincs sima szöveges változat): sortörések megtartva, a jelölések nélkül
export function htmlToText(html) {
  return String(html || '')
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

// A válasz saját része: az idézett előzmény ("> ..." sorok, "... írta:", "On ... wrote:", "-----Original Message-----") levágva
const QUOTE_START = [
  /^\s*>/,
  /^\s*(On|Am|Le)\s.+(wrote|schrieb|écrit)\s*:\s*$/i,
  /^.{0,200}\sírta\s*(\(.*\))?\s*:\s*$/i,
  /^\s*-{2,}\s*(Original Message|Eredeti üzenet|Forwarded message|Továbbított üzenet)/i,
  /^\s*(From|Feladó|Küldő):\s/i,
];
export function stripQuoted(text, max = 4000) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const cut = lines.findIndex(l => QUOTE_START.some(re => re.test(l)));
  const own = (cut === -1 ? lines : lines.slice(0, cut)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return own.slice(0, max);
}

// Svix aláírás: base64(HMAC-SHA256(kulcs, "<svix-id>.<svix-timestamp>.<nyers törzs>")); a kulcs a "whsec_" utáni base64 rész.
// A fejlécben több aláírás is lehet szóközzel elválasztva ("v1,<aláírás> v1,<aláírás2>"). Legfeljebb 5 perces eltérés.
export function verifySvix(secret, { id, timestamp, signature }, body, now = Date.now()) {
  if (!secret || !id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > 300) return false;
  const key = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest();
  return String(signature).split(' ').some(part => {
    const [version, sig] = part.split(',');
    if (version !== 'v1' || !sig) return false;
    const given = Buffer.from(sig, 'base64');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

// Az üzenet szövegének ellenőrzése: { text } vagy { error }
export function cleanMessageText(value, max = 4000) {
  const text = String(value ?? '').replace(/\r\n?/g, '\n').trim();
  if (!text) return { error: 'Írd be az üzenetet.' };
  if (text.length > max) return { error: `Az üzenet legfeljebb ${max} karakter lehet.` };
  return { text };
}
