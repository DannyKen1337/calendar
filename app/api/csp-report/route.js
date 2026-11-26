import { NextResponse } from 'next/server';
import { getTavernDb } from '@/lib/mongodb';
import { logSystemError } from '@/lib/systemLog';
import { consumeRateLimit } from '@/lib/rateLimit';
import { parseCspReports } from '@/lib/cspReport';

export const dynamic = 'force-dynamic';

// A böngésző ide jelenti, ha a Content-Security-Policy letiltott valamit (lib/csp.js: report-uri). A jelentés a
// tulajdonosi Rendszer oldal szerverhibái közé kerül („csp” forrással), így kiderül, ha egy oldalunk elromlott, vagy ha
// valaki scriptet próbált becsempészni. IP-címenként korlátozva, a böngészőbővítmények zaja kiszűrve.
export async function POST(request) {
  try {
    const text = (await request.text()).slice(0, 20000);
    const reports = parseCspReports(text);
    if (!reports.length) return new NextResponse(null, { status: 204 });
    const db = await getTavernDb();
    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    if (!(await consumeRateLimit(db, `csp-ip:${ip}`, 30, 60 * 60 * 1000))) return new NextResponse(null, { status: 204 });
    for (const r of reports.slice(0, 5)) {
      await logSystemError('csp', `${r.directive}: ${r.blocked} (${r.page})`, r);
    }
    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
