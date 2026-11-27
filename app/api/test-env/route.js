import { NextResponse } from 'next/server';
import clientPromise, { tavernDbName } from '@/lib/mongodb';
import { verifyOwner } from '@/lib/auth';
import { isCronAuthorized } from '@/lib/cronAuth';
import { isTestEnv, LIVE_DB } from '@/lib/testEnv';
import { refreshPublic } from '@/lib/publicCache';
import { logSystemError } from '@/lib/systemLog';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Tesztkörnyezet (lib/testEnv.js): friss másolat az éles adatokról. Csak a tesztkörnyezetben él; a tulajdonos
// (Rendszer oldal) vagy az első beállításkor a TEST_SETUP_SECRET kulccsal (Authorization: Bearer …) indíthatja.
// Az éles adatbázist csak olvassa; a teszt adatbázis gyűjteményeit lecseréli. Ami kimarad: a belépési próbák és
// korlátok (rate_limits), a telefonos feliratkozások (push_subscriptions: valódi eszközök), a rendszernapló hibái.
const SKIP = new Set(['rate_limits', 'push_subscriptions', 'system_errors', 'system_runs']);
const BATCH = 500;

export async function GET() {
  if (!isTestEnv()) return NextResponse.json({ error: 'Nem található.' }, { status: 404 });
  if (!(await verifyOwner())) return NextResponse.json({ error: 'Csak a tulajdonos.' }, { status: 403 });
  return NextResponse.json({ testEnv: true, db: tavernDbName() });
}

export async function POST(request) {
  if (!isTestEnv()) return NextResponse.json({ error: 'Nem található.' }, { status: 404 });
  const bySecret = isCronAuthorized(request, process.env.TEST_SETUP_SECRET);
  if (!bySecret && !(await verifyOwner())) return NextResponse.json({ error: 'Csak a tulajdonos.' }, { status: 403 });
  const target = tavernDbName(); // a tesztkörnyezetben sosem az éles (lib/mongodb.js)
  if (target === LIVE_DB) return NextResponse.json({ error: 'A teszt adatbázis nincs beállítva.' }, { status: 500 });
  try {
    const client = await clientPromise;
    const src = client.db(LIVE_DB), dst = client.db(target);
    const names = (await src.listCollections({}, { nameOnly: true }).toArray()).map(c => c.name).filter(n => !SKIP.has(n) && !n.startsWith('system.'));
    const counts = {};
    for (const name of names) {
      await dst.collection(name).drop().catch(() => {});
      let batch = [], n = 0;
      for await (const doc of src.collection(name).find({})) {
        batch.push(doc);
        if (batch.length >= BATCH) { await dst.collection(name).insertMany(batch, { ordered: false }); n += batch.length; batch = []; }
      }
      if (batch.length) { await dst.collection(name).insertMany(batch, { ordered: false }); n += batch.length; }
      counts[name] = n;
    }
    // az indexek a következő kapcsolódáskor újra létrejönnek (lib/mongodb.js); a nyilvános oldalak gyorsítótára friss lesz
    refreshPublic();
    await dst.collection('audit_logs').insertOne({ adminName: bySecret ? 'beállítás' : 'tulajdonos', action: 'TESZT MÁSOLAT', details: `Friss másolat az éles adatokról: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}`, date: new Date() });
    return NextResponse.json({ success: true, counts });
  } catch (error) {
    await logSystemError('teszt másolat', error);
    return NextResponse.json({ error: 'A másolás nem sikerült.' }, { status: 500 });
  }
}
