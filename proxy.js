import { NextResponse } from 'next/server';
import { isCrossOriginWrite } from '@/lib/requestGuard';
import { buildCsp, newNonce } from '@/lib/csp';
import { adminPath, isGatedPage, isGatedApi, passesGate, gateToken, GATE_COOKIE, GATE_MAX_AGE } from '@/lib/adminGate';

// Minden kérés előtt fut (Next 16: a régi middleware neve proxy).
// - Rejtett admin (ADMIN_PATH, lib/adminGate.js): a titkos cím kaput nyit (süti), kapu nélkül az admin, a weboldal
//   szerkesztője és a belépés 404-et ad. ADMIN_PATH nélkül ki van kapcsolva.
// - API: idegen oldalról indított írási kérés elutasítása (CSRF), lásd lib/requestGuard.js.
// - Oldalak: Content-Security-Policy kérésenként új nonce-szal (lib/csp.js). A Next a kérés CSP-fejlécéből veszi ki a
//   nonce-ot, és ráteszi a saját scriptjeire; a saját inline scriptjeink az x-nonce fejlécből kapják meg.
const SESSION_COOKIE = 'tavern_session';
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

export async function proxy(request) {
  const { pathname } = request.nextUrl;
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
    return NextResponse.next();
  }

  const response = withCsp(request, pathname);
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
