// Fogad-e levelet az e-mail cím domainje (MX-rekord a DNS-ben)? A nyilvános űrlapok (jelentkezés, előrendelés, kérdés,
// asztalfoglalás) és az admin (új fiók, kézi jelentkező) mentés előtt ezzel szűrik ki az elírt / nem létező címeket,
// hogy a visszaigazoló levelek tényleg célba érjenek.
//  - gyakori elírás (gmial.com, freemial.hu…): elutasítja, és javasolja a helyeset
//  - MX-rekord van: rendben; „null MX” (RFC 7505: a domain jelzi, hogy nem fogad levelet): elutasítja
//  - nincs MX, de van A / AAAA: rendben (a levelezés ilyenkor a címre megy, RFC 5321)
//  - a domain nem létezik / semmi nincs rajta: elutasítja
//  - a DNS nem válaszol / hiba / időtúllépés: átengedi (a felhasználót nem akasztjuk meg egy DNS-hiba miatt)
// Az eredmény egy órára gyorsítótárba kerül. A teszthez (nem élesben) EMAIL_MX_FAKE=1: hamis feloldó, ahol a
// `nincs-level.hu` és a `.invalid` végű domainek nem léteznek, a `null-mx.hu` null MX-et ad, minden más rendben van.
import { promises as dns } from 'node:dns';

const TYPOS = {
  'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gnail.com': 'gmail.com',
  'gmaill.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.cm': 'gmail.com', 'gmail.con': 'gmail.com', 'gmali.com': 'gmail.com', 'gmeil.com': 'gmail.com',
  'freemial.hu': 'freemail.hu', 'freemai.hu': 'freemail.hu', 'fremail.hu': 'freemail.hu', 'freemail.hú': 'freemail.hu', 'freemal.hu': 'freemail.hu',
  'citromial.hu': 'citromail.hu', 'citromai.hu': 'citromail.hu', 'citromal.hu': 'citromail.hu',
  'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'hotmail.co': 'hotmail.com', 'hotmal.com': 'hotmail.com',
  'outlok.com': 'outlook.com', 'outloo.com': 'outlook.com', 'outlook.co': 'outlook.com',
  'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'icloud.co': 'icloud.com', 'iclod.com': 'icloud.com',
};
export const suggestEmail = (email) => {
  const [local, domain] = String(email || '').toLowerCase().split('@');
  return local && TYPOS[domain] ? `${local}@${TYPOS[domain]}` : null;
};

const TTL_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 3000;
const cache = new Map(); // domain → { at, result }

const fakeResolver = {
  async resolveMx(d) {
    if (d === 'nincs-level.hu' || d.endsWith('.invalid')) throw Object.assign(new Error('nincs'), { code: 'ENOTFOUND' });
    if (d === 'null-mx.hu') return [{ exchange: '', priority: 0 }];
    if (d === 'csak-a.hu') throw Object.assign(new Error('nincs mx'), { code: 'ENODATA' });
    if (d === 'dns-hiba.hu') throw Object.assign(new Error('timeout'), { code: 'ETIMEOUT' });
    return [{ exchange: `mx.${d}`, priority: 10 }];
  },
  async resolve4(d) { if (d === 'csak-a.hu') return ['192.0.2.1']; throw Object.assign(new Error('nincs'), { code: 'ENODATA' }); },
  async resolve6() { throw Object.assign(new Error('nincs'), { code: 'ENODATA' }); },
};
const defaultResolver = () => (process.env.EMAIL_MX_FAKE === '1' && process.env.NODE_ENV !== 'production' ? fakeResolver : dns);

const NOT_FOUND = new Set(['ENOTFOUND', 'ENODATA', 'NXDOMAIN', 'ENONAME']);
const withTimeout = (p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })), TIMEOUT_MS))]);

async function lookup(domain, resolver) {
  try {
    const mx = await withTimeout(resolver.resolveMx(domain));
    if (!mx?.length) return { ok: false, reason: 'nomail' };
    if (mx.length === 1 && (!mx[0].exchange || mx[0].exchange === '.')) return { ok: false, reason: 'nullmx' };
    return { ok: true };
  } catch (err) {
    if (!NOT_FOUND.has(err?.code)) return { ok: true, unchecked: true }; // DNS-hiba: átengedjük
    // nincs MX: ha van A / AAAA rekord, a levél oda mehet
    for (const fn of ['resolve4', 'resolve6']) {
      try { const r = await withTimeout(resolver[fn](domain)); if (r?.length) return { ok: true }; } catch (e) { if (!NOT_FOUND.has(e?.code)) return { ok: true, unchecked: true }; }
    }
    return { ok: false, reason: err.code === 'ENOTFOUND' ? 'nodomain' : 'nomail' };
  }
}

// { ok: true } vagy { ok: false, error, suggestion? } – az error a felhasználónak szóló, magyar mondat
export async function checkEmailDomain(email, { resolver = defaultResolver(), useCache = true } = {}) {
  const addr = String(email || '').trim().toLowerCase();
  const domain = addr.split('@')[1] || '';
  if (!domain) return { ok: false, error: 'Érvényes e-mail címet adj meg.' };
  const suggestion = suggestEmail(addr);
  if (suggestion) return { ok: false, suggestion, error: `Elírás lehet az e-mail címben. Erre gondoltál: ${suggestion}?` };
  const hit = useCache && cache.get(domain);
  let result = hit && Date.now() - hit.at < TTL_MS ? hit.result : null;
  if (!result) {
    result = await lookup(domain, resolver);
    if (useCache && !result.unchecked) cache.set(domain, { at: Date.now(), result });
  }
  if (result.ok) return { ok: true };
  return { ok: false, error: result.reason === 'nodomain' ? `A(z) „${domain}” domain nem létezik, erre a címre nem tudunk levelet küldeni. Ellenőrizd, nincs-e elírás.` : `A(z) „${domain}” címre nem lehet levelet küldeni (nem fogad leveleket). Ellenőrizd, nincs-e elírás.` };
}
