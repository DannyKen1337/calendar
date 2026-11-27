import { NextResponse } from 'next/server';
import { isCrossOriginWrite } from '@/lib/requestGuard';
import { buildCsp, newNonce } from '@/lib/csp';
import { adminPath, isGatedPage, isGatedApi, passesGate, gateToken, GATE_COOKIE, GATE_MAX_AGE } from '@/lib/adminGate';
import { isTestEnv, testOpenPath, testSessionUser, liveUrlFor, LIVE_URL } from '@/lib/testEnv';
import { jwtVerify } from 'jose';

// Minden kérés előtt fut (Next 16: a régi middleware neve proxy).
// - Rejtett admin (ADMIN_PATH, lib/adminGate.js): a titkos cím kaput nyit (süti), kapu nélkül az admin, a weboldal
//   szerkesztője és a belépés 404-et ad. ADMIN_PATH nélkül ki van kapcsolva.
// - API: idegen oldalról indított írási kérés elutasítása (CSRF), lásd lib/requestGuard.js.
// - Oldalak: Content-Security-Policy kérésenként új nonce-szal (lib/csp.js). A Next a kérés CSP-fejlécéből veszi ki a
//   nonce-ot, és ráteszi a saját scriptjeire; a saját inline scriptjeink az x-nonce fejlécből kapják meg.
const SESSION_COOKIE = 'tavern_session';
const FRESH_COOKIE = 'tavern_friss';
const prod = process.env.NODE_ENV === 'production';

const gateCookieOptions = { httpOnly: true, secure: prod, sameSite: 'lax', path: '/', maxAge: GATE_MAX_AGE };

function withCsp(request, pathname, rewriteTo = null) {
  const nonce = newNonce();
  const csp = buildCsp({ nonce, pathname, dev: !prod });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  const response = rewriteTo
    ? NextResponse.rewrite(new URL(rewriteTo, request.url), { request: { headers: requestHeaders } })
    : NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

// A régi cím (taverncalendar.vercel.app): minden oldal a www.tavern.hu ugyanazon útjára költözik (308, a paraméterekkel
// együtt; a régi gyökér a naptár volt: /naptar). Csak az oldalak megnyitása (GET/HEAD) és a naptár-előfizetés (ICS)
// irányít át, a többi API nem: egy épp nyitva lévő régi lap még működik, és az időzítők sem akadnak el. A régi címen belépett szervező az új admin belépőjére kerül (a titkos cím csak
// érvényes belépéssel derül ki; az új címen újra be kell lépni, mert a belépés címenként külön tárolódik).
const OLD_HOSTS = new Set(['taverncalendar.vercel.app']);
async function oldHostRedirect(request, pathname) {
  const host = (request.headers.get('x-forwarded-host') || request.headers.get('host') || '').toLowerCase().split(':')[0];
  if (!OLD_HOSTS.has(host) || !['GET', 'HEAD'].includes(request.method)) return null;
  // az API nem költözik (egy nyitott régi lap kérései, a Vercel időzítői), kivéve a naptár-előfizetést (ICS)
  if (pathname.startsWith('/api/') && pathname !== '/api/export') return null;
  const gate = adminPath();
  if (gate && /^\/(admin|weblapteszt\/(admin|elonezet))(\/|$)/.test(pathname)) {
    const session = request.cookies.get(SESSION_COOKIE)?.value;
    const secret = process.env.JWT_SECRET;
    if (session && secret) {
      try {
        await jwtVerify(session, new TextEncoder().encode(secret), { algorithms: ['HS256'] });
        return NextResponse.redirect(`${LIVE_URL}${gate}`, 307);
      } catch { /* lejárt vagy hamis süti: a sima átirányítás (az új címen a rejtett admin 404-et ad) */ }
    }
  }
  const { search } = request.nextUrl;
  return NextResponse.redirect(`${LIVE_URL}${pathname === '/' ? '/naptar' : pathname}${search}`, 308);
}

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  const moved = await oldHostRedirect(request, pathname);
  if (moved) return moved;

  // Tesztkörnyezet (lib/testEnv.js): csak a tesztfiókokkal belépve látható; aki nincs belépve, az élő oldal ugyanazon
  // címére kerül. A belépő oldal és a belépés nyitva van.
  if (isTestEnv() && !testOpenPath(pathname) && !(await testSessionUser(request.cookies.get(SESSION_COOKIE)?.value))) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Ez a tesztkörnyezet: csak a tesztfiókokkal, belépve érhető el.' }, { status: 401 });
    return NextResponse.redirect(liveUrlFor(request.url), 307);
  }
  const gate = adminPath();
  let setGateCookie = false;

  if (gate) {
    // A titkos cím: kaput nyit, és az adminra visz (a cím nem marad a böngésző címsorában)
    if (pathname === gate || pathname === `${gate}/`) {
      const res = NextResponse.redirect(new URL('/admin', request.url));
      res.cookies.set(GATE_COOKIE, await gateToken(gate), gateCookieOptions);
      res.headers.set('Cache-Control', 'no-store');
      res.headers.set('Referrer-Policy', 'no-referrer');
      res.headers.set('X-Robots-Tag', 'noindex, nofollow');
      return res;
    }
    const gatedApi = isGatedApi(pathname, request.method);
    const gatedPage = !gatedApi && isGatedPage(pathname);
    if (gatedApi || gatedPage) {
      const gateCookie = request.cookies.get(GATE_COOKIE)?.value;
      const ok = await passesGate({ gateCookie, sessionCookie: request.cookies.get(SESSION_COOKIE)?.value, path: gate });
      if (!ok) {
        if (gatedApi) return NextResponse.json({ error: 'Nem található.' }, { status: 404 });
        // ugyanaz a 404-es oldal, mint bármely nem létező címen
        return withCsp(request, pathname, '/_nem-talalhato');
      }
      // aki a belépése miatt jutott be, kapu-sütit is kap, hogy kilépés után is megtalálja a belépő oldalt
      setGateCookie = !gateCookie;
    }
  }

  if (pathname.startsWith('/api/')) {
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    if (isCrossOriginWrite({ method: request.method, origin: request.headers.get('origin'), host })) {
      return NextResponse.json({ error: 'Ezt a kérést csak a Tavern oldaláról lehet elküldeni.' }, { status: 403 });
    }
    const res = NextResponse.next();
    // Írás után egy percig a nyilvános naptár a CDN tárolója helyett friss adatot kér (app/useCalendar.js,
    // lib/publicCache.js): aki jelentkezett vagy módosított, rögtön a saját változtatását látja
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && pathname !== '/api/csp-report') {
      res.cookies.set(FRESH_COOKIE, '1', { path: '/', maxAge: 60, sameSite: 'lax', secure: prod });
    }
    return res;
  }

  const response = withCsp(request, pathname);
  if (isTestEnv()) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  if (setGateCookie) response.cookies.set(GATE_COOKIE, await gateToken(gate), gateCookieOptions);
  if (gate && isGatedPage(pathname)) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

export const config = {
  matcher: [
    '/api/:path*',
    // Oldalak: a statikus fájlok (képek, betűk, a Next csomagjai, service worker, manifest) kimaradnak. Az előtöltés
    // (prefetch) kérései is átmennek rajta: különben egy ilyen fejléccel kért admin oldal megkerülné a kaput.
    '/((?!api/|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|css|js|map|txt|xml|json|webmanifest)$).*)',
  ],
};
