import { NextResponse } from 'next/server';
import { getTavernDb } from '@/lib/mongodb';
import { syncDueRgnEvents } from '@/lib/rgnSync';
import { recordRun } from '@/lib/systemLog';

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
    // A futás eredménye (és hibája) a tulajdonosi Rendszer oldalon látszik
    const result = await recordRun('rgn-sync', async () => {
      const db = await getTavernDb();
      const synced = await syncDueRgnEvents(db, { maxAgeMs: 0, budgetMs: 50000, limit: 50 });
      return { synced };
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
