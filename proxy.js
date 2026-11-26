import { NextResponse } from 'next/server';
import { isCrossOriginWrite } from '@/lib/requestGuard';

// Minden kérés előtt fut (Next 16: a régi middleware neve proxy).
// API: idegen oldalról indított írási kérés elutasítása (CSRF), lásd lib/requestGuard.js.
export function proxy(request) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (isCrossOriginWrite({ method: request.method, origin: request.headers.get('origin'), host })) {
    return NextResponse.json({ error: 'Ezt a kérést csak a Tavern oldaláról lehet elküldeni.' }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
