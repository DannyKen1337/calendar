import { NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cronAuth';
import { getTavernDb } from '@/lib/mongodb';
import { appUrl } from '@/lib/mailer';
import { syncMailbox } from '@/lib/mailboxSync';

export const dynamic = 'force-dynamic';

// A rendszer postafiókjának megnézése (új válaszok → szál + telefonos értesítés, Beérkezett levelek) akkor is, ha senkinél
// nincs nyitva az admin. A Vercel időzítője hívja kétpercenként (vercel.json, Pro csomag; a Vercel magától küldi az
// Authorization: Bearer <CRON_SECRET> fejlécet). Egyszerre csak egy fut, legfeljebb félpercenként.
export async function GET(request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Jogosulatlan hozzáférés' }, { status: 401 });
  }
  const db = await getTavernDb();
  const res = await syncMailbox(db, appUrl(request), { minGapMs: 30000 });
  return NextResponse.json(res, { status: res.error ? 502 : 200 });
}
