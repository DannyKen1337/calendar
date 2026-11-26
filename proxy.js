import { NextResponse } from 'next/server';
import { isCrossOriginWrite } from '@/lib/requestGuard';
import { buildCsp, newNonce } from '@/lib/csp';

// Minden kérés előtt fut (Next 16: a régi middleware neve proxy).
// - API: idegen oldalról indított írási kérés elutasítása (CSRF), lásd lib/requestGuard.js.
// - Oldalak: Content-Security-Policy kérésenként új nonce-szal (lib/csp.js). A Next a kérés CSP-fejlécéből veszi ki a
//   nonce-ot, és ráteszi a saját scriptjeire; a saját inline scriptjeink az x-nonce fejlécből kapják meg.
export function proxy(request) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    if (isCrossOriginWrite({ method: request.method, origin: request.headers.get('origin'), host })) {
      return NextResponse.json({ error: 'Ezt a kérést csak a Tavern oldaláról lehet elküldeni.' }, { status: 403 });
    }
    return NextResponse.next();
  }

  const nonce = newNonce();
  const csp = buildCsp({ nonce, pathname, dev: process.env.NODE_ENV === 'development' });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    '/api/:path*',
    // Oldalak: a statikus fájlok (képek, betűk, a Next csomagjai, service worker, manifest) kimaradnak;
    // az előtöltés (prefetch) kérései sem kapnak CSP-t (azok nem HTML oldalak)
    {
      source: '/((?!api/|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|css|js|map|txt|xml|json|webmanifest)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
