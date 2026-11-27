import { NextResponse, after } from 'next/server';
import { logSystemError } from '@/lib/systemLog';
import { getTavernDb } from '@/lib/mongodb';
import { syncDueRgnEvents } from '@/lib/rgnSync';
import { refreshPublic, TAG, CDN_HEADERS } from '@/lib/publicCache';
import { getPublicCalendarData } from '@/lib/publicCalendar';

export const dynamic = 'force-dynamic';

// A nyilvános naptár adata (lib/publicCalendar.js, gyorsítótárazva); a Vercel CDN-je is 15 mp-ig maga szolgálja ki
// (CDN_HEADERS), így egy roham vagy bot nem éri el a függvényt.

// A Riftbound események létszáma: eseményenként legfeljebb 15 percenként frissül, a válasz után a háttérben
// (példányonként legfeljebb percenként néz rá); ha frissült valami, a naptár gyorsítótára is
let lastRgnCheck = 0;
function syncRgnInBackground() {
  if (Date.now() - lastRgnCheck < 60 * 1000) return;
  lastRgnCheck = Date.now();
  after(async () => {
    try {
      const db = await getTavernDb();
      if (await syncDueRgnEvents(db, { maxAgeMs: 15 * 60 * 1000, budgetMs: 2500 })) refreshPublic(TAG.naptar);
    } catch { /* a következő kérésnél újra próbálja */ }
  });
}

export async function GET() {
  try {
    syncRgnInBackground();
    const data = await getPublicCalendarData();
    // a szerver ideje a böngésző órájának igazításához (nem a tárolt adat része)
    return NextResponse.json({ ...data, serverTime: Date.now() }, { headers: CDN_HEADERS });
  } catch (error) {
    console.error('public-data error:', error);
    await logSystemError('public-data', error);
    return NextResponse.json({ error: "Adatbázis hiba" }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
