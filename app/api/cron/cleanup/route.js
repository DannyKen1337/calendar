import { NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cronAuth';
import { getTavernDb } from '@/lib/mongodb';
import { recordRun } from '@/lib/systemLog';
import { runCleanup } from '@/lib/cleanup';

export const dynamic = 'force-dynamic';
// a Drive-mentés (nagyobb fájl feltöltése) időbe telhet
export const maxDuration = 300;

// Heti takarítás (Vercel Cron, hétfőnként): előbb a Google Drive-ra menti, amit töröl, utána töröl (lib/cleanup.js).
// Ha a mentés nem sikerül, nem töröl semmit; a hiba a Rendszer oldalon látszik.
export async function GET(request) {
  // Kulcs nélkül (hiányzó CRON_SECRET) nem enged át; állandó idejű összehasonlítás
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Jogosulatlan hozzáférés' }, { status: 401 });
  }
  try {
    // A futás eredménye (és hibája) a tulajdonosi Rendszer oldalon látszik
    const result = await recordRun('cleanup', async () => runCleanup(await getTavernDb()));
    return NextResponse.json({ success: true, ...result });
  } catch {
    // A hiba részletei a tulajdonosi Rendszer oldalon látszanak (recordRun), a válaszba nem kerülnek
    return NextResponse.json({ error: 'A futás nem sikerült.' }, { status: 500 });
  }
}
