// Content-Security-Policy: a böngésző csak a saját, az adott kéréshez kapott nonce-szal megjelölt scriptjeinket futtatja
// (a Next a saját scriptjeire magától teszi rá, a többit 'strict-dynamic' engedi: amit egy megbízható script tölt be).
// Beszúrt <script>, onclick="…" vagy javascript: link nem fut le, idegen oldalról script nem tölthető be.
// A proxy.js minden oldalkérésnél új nonce-ot készít; az oldalak ezért kérésenként renderelődnek (a gyökér-layoutok
// connection() / headers() hívása). A megsértett szabályokat a böngésző a /api/csp-report címre jelenti (Rendszer oldal).

// Beágyazás (frame-ancestors): az admin és a leiratkozás sehová; az űrlapos és tartalmi oldalak csak a saját
// oldalainkba (a weboldal, a webshop, FRAME_ANCESTORS); a naptár (/ és /embed) szándékosan bárhová (pl. a webshopba).
const NO_FRAMING = [/^\/admin(\/|$)/, /^\/weblapteszt\/admin(\/|$)/, /^\/leiratkozas(\/|$)/];
const OWN_FRAMED = [/^\/esemeny(\/|$)/, /^\/jelentkezes(\/|$)/, /^\/elorendeles(\/|$)/, /^\/asztalfoglalas(\/|$)/, /^\/liga(\/|$)/, /^\/weblapteszt(\/|$)/];
// A szerkesztőfelületeken a HEIC-képek átalakítója (heic2any, Emscripten) new Function-t használ: csak itt kell 'unsafe-eval'.
// Ezek az oldalak belépéshez kötöttek; a nyilvános oldalakon nincs eval.
const EDITOR_PAGES = [/^\/admin(\/|$)/, /^\/weblapteszt\/admin(\/|$)/];

const originOf = (url) => { try { return url ? new URL(url).origin : null; } catch { return null; } };
const HTTPS_SOURCE = /^https:\/\/(\*\.)?[\w.-]+(:\d+)?$/;

export function frameAncestors(pathname, env = process.env) {
  if (NO_FRAMING.some(re => re.test(pathname))) return "'none'";
  if (!OWN_FRAMED.some(re => re.test(pathname))) return null; // bárhová beágyazható
  const list = [
    "'self'", 'https://tavern.hu', 'https://*.tavern.hu',
    originOf(env.WEBSHOP_URL),
    ...String(env.FRAME_ANCESTORS || '').split(/\s+/).filter(v => HTTPS_SOURCE.test(v)),
  ].filter(Boolean);
  return [...new Set(list)].join(' ');
}

export function newNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function buildCsp({ nonce, pathname = '/', dev = false, env = process.env }) {
  const evalOk = dev || EDITOR_PAGES.some(re => re.test(pathname));
  // a weboldal ablakai a naptár oldalait töltik be (CALENDAR_URL), a boltok térképe a Google-é
  const frames = ["'self'", originOf(env.CALENDAR_URL), 'https://maps.google.com', 'https://www.google.com'].filter(Boolean);
  const ancestors = frameAncestors(pathname, env);
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${evalOk ? " 'unsafe-eval'" : ''}`,
    // stílus: az antd és a React style={…} beágyazott stílust használ (stílusból script nem futtatható)
    "style-src 'self' 'unsafe-inline'",
    // képek: az esemény képe bármilyen https címről jöhet (a szervező adja meg), a Facebook / Instagram posztok képei is
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? ' ws: wss:' : ''}`,
    `frame-src ${[...new Set(frames)].join(' ')}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self' blob: https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(ancestors ? [`frame-ancestors ${ancestors}`] : []),
    ...(dev ? [] : ['upgrade-insecure-requests']),
    'report-uri /api/csp-report',
  ];
  return directives.join('; ');
}
