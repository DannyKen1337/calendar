import { NextResponse } from 'next/server';
import { getTavernDb } from '@/lib/mongodb';
import { syncDueRgnEvents } from '@/lib/rgnSync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Napi Riftbound szinkron (Vercel cron): akkor is rögzíti a jelentkezéseket és lejelentkezéseket,
// ha napközben senki nem nyitja meg az admin felületet. Napközben az admin felület és a naptár betöltése is frissít.
export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Jogosulatlan hozzáférés' }, { status: 401 });
  }
  try {
    const db = await getTavernDb();
    const count = await syncDueRgnEvents(db, { maxAgeMs: 0, budgetMs: 50000, limit: 50 });
    return NextResponse.json({ success: true, synced: count });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
