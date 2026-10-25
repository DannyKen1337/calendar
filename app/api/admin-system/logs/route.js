import { NextResponse } from 'next/server';
import { getTavernDb } from '@/lib/mongodb';
import { verifyOwner } from '@/lib/auth';
import { logSystemError } from '@/lib/systemLog';
import { buildXlsx } from '@/lib/xlsx';

export const dynamic = 'force-dynamic';

// Tevékenységnapló a tulajdonosnak: szűrés (szöveg, művelet, szervező, időszak), lapozás és Excel-export (?format=xlsx).
// A szűrőlistákhoz visszaadja az előforduló műveleteket és szervezőket is.

const MAX_PAGE = 200;
const MAX_EXPORT = 20000;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const formatHu = (d) => (d ? new Date(d).toLocaleString('hu-HU', { timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '');

// "YYYY-MM-DD" Budapest szerinti nap kezdete (a nyári időszámítást a böngészőtől függetlenül kezeljük)
function budapestDayStart(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day || '')) return null;
  const utcMidnight = new Date(`${day}T00:00:00Z`);
  const offsetH = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Budapest', hour: '2-digit', hourCycle: 'h23' }).format(utcMidnight));
  return new Date(utcMidnight.getTime() - offsetH * 3600 * 1000);
}

function buildQuery(params) {
  const query = {};
  const q = (params.get('q') || '').trim().slice(0, 100);
  if (q) {
    const re = { $regex: escapeRegex(q), $options: 'i' };
    query.$or = [{ adminName: re }, { action: re }, { details: re }];
  }
  const action = params.get('action');
  if (action) query.action = action;
  const admin = params.get('admin');
  if (admin) query.adminName = admin;
  const from = budapestDayStart(params.get('from'));
  const toStart = budapestDayStart(params.get('to'));
  if (from || toStart) {
    query.date = {};
    if (from) query.date.$gte = from;
    if (toStart) query.date.$lt = new Date(toStart.getTime() + 24 * 3600 * 1000);
  }
  return query;
}

export async function GET(request) {
  try {
    const session = await verifyOwner();
    if (!session) return NextResponse.json({ error: 'A naplót csak a tulajdonos láthatja.' }, { status: 403 });
    const params = new URL(request.url).searchParams;
    const db = await getTavernDb();
    const logs = db.collection('audit_logs');
    const query = buildQuery(params);

    if (params.get('format') === 'xlsx') {
      const rows = await logs.find(query).sort({ date: -1 }).limit(MAX_EXPORT).toArray();
      const buffer = buildXlsx([{
        name: 'Napló',
        rows: [['Időpont', 'Szervező', 'Művelet', 'Részletek'], ...rows.map(l => [formatHu(l.date), l.adminName || '', l.action || '', l.details || ''])],
        widths: [20, 18, 26, 100],
      }]);
      const date = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Budapest' });
      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="naplo_${date}.xlsx"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const limit = Math.min(MAX_PAGE, Math.max(1, Number(params.get('limit')) || 50));
    const skip = Math.max(0, Number(params.get('skip')) || 0);
    const [items, total, actions, admins] = await Promise.all([
      logs.find(query).sort({ date: -1 }).skip(skip).limit(limit).toArray(),
      logs.countDocuments(query),
      logs.distinct('action'),
      logs.distinct('adminName'),
    ]);
    const sortHu = (a) => a.filter(Boolean).sort((x, y) => String(x).localeCompare(String(y), 'hu'));
    return NextResponse.json({
      items: items.map(l => ({ id: String(l._id), date: l.date, adminName: l.adminName, action: l.action, details: l.details })),
      total, actions: sortHu(actions), admins: sortHu(admins),
    });
  } catch (error) {
    console.error('admin-system logs error:', error);
    await logSystemError('admin-system logs', error);
    return NextResponse.json({ error: 'A napló lekérése nem sikerült.' }, { status: 500 });
  }
}
