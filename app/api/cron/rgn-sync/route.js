import { NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cronAuth';
import { getTavernDb } from '@/lib/mongodb';
import { syncDueRgnEvents } from '@/lib/rgnSync';
import { recordRun } from '@/lib/systemLog';
import { syncAllLeagues } from '@/lib/leagueSync';
import { refreshPublic, TAG } from '@/lib/publicCache';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Napi Riftbound szinkron (Vercel cron): akkor is rögzíti a jelentkezéseket és lejelentkezéseket,
// ha napközben senki nem nyitja meg az admin felületet. Napközben az admin felület és a naptár betöltése is frissít.
// Utána a ligákba is beemeli az eseményekre jelentkezett új játékosokat.
async function handleGET(request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Jogosulatlan hozzáférés' }, { status: 401 });
  }
  try {
    // A futás eredménye (és hibája) a tulajdonosi Rendszer oldalon látszik
    const result = await recordRun('rgn-sync', async () => {
      const db = await getTavernDb();
      const synced = await syncDueRgnEvents(db, { maxAgeMs: 0, budgetMs: 45000, limit: 50 });
      // Utána a ligák: az új jelentkezők beemelése (akkor is, ha senki nem nyitja meg a liga oldalt)
      const leaguePlayers = await syncAllLeagues(db);
      return { synced, leaguePlayers };
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    // A hiba részletei a tulajdonosi Rendszer oldalon látszanak (recordRun), a válaszba nem kerülnek
    return NextResponse.json({ error: 'A futás nem sikerült.' }, { status: 500 });
  }
}

// A Riftbound-létszámok frissítése után a nyilvános naptár azonnal frissül (lib/publicCache.js)
export async function GET(request) {
  const res = await handleGET(request);
  if (res.status < 400) refreshPublic(TAG.naptar);
  return res;
}
