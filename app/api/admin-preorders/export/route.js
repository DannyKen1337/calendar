import { getTavernDb } from '@/lib/mongodb';
import { verifyAdmin } from '@/lib/auth';
import { canManageCategory } from '@/lib/permissions';
import { toObjectId } from '@/lib/preorderData';
import { groupByGame, productStock, productLimit } from '@/lib/preorders';
import { buildXlsx } from '@/lib/xlsx';

export const dynamic = 'force-dynamic';

const formatHu = (d) => (d ? new Date(d).toLocaleString('hu-HU', { timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase().slice(0, 40);

// Előrendelések Excel-ben: ?productId=... egy termék, egyébként az összes kezelhető termék.
// Két munkalap: összesítés termékenként (rendeléshez) és a jelentkezők listája.
export async function GET(request) {
  try {
    const session = await verifyAdmin();
    if (!session) return new Response(JSON.stringify({ error: 'Jogosulatlan hozzáférés' }), { status: 401 });

    const productId = new URL(request.url).searchParams.get('productId');
    const db = await getTavernDb();
    const query = {};
    if (productId) {
      const oid = toObjectId(productId);
      if (!oid) return new Response(JSON.stringify({ error: 'Hibás termék.' }), { status: 400 });
      query._id = oid;
    }
    const products = (await db.collection('preorder_products').find(query).sort({ createdAt: -1 }).toArray())
      .filter(p => canManageCategory(session, p.category));
    if (productId && products.length === 0) return new Response(JSON.stringify({ error: 'A termék nem található.' }), { status: 404 });

    // Játék, majd termék szerint rendezve, ahogy az admin oldalon is látszik
    const ordered = groupByGame(products).flatMap(g => g.items);
    const orders = ordered.length
      ? await db.collection('preorders').find({ productId: { $in: ordered.map(p => String(p._id)) } }).sort({ date: 1 }).toArray()
      : [];
    const byProduct = new Map(ordered.map(p => [String(p._id), []]));
    orders.forEach(o => byProduct.get(o.productId)?.push(o));

    const summary = [['Termék', 'Játék', 'Megjelenés', 'Állapot', 'Jelentkezők', 'Összes darab', 'Elérhető mennyiség', 'Limit / fő']];
    const list = [['Termék', 'Játék', 'Név', 'E-mail', 'Telefon', 'Darab', 'Leadva', 'Utoljára módosítva']];
    ordered.forEach(p => {
      const rows = byProduct.get(String(p._id));
      summary.push([p.name, p.category, p.releaseDate || '', p.isOpen ? 'Nyitott' : 'Lezárva', rows.length, rows.reduce((s, o) => s + (o.quantity || 0), 0), productStock(p) ?? 'nincs megadva', productLimit(p) || 'korlátlan']);
      rows.forEach(o => list.push([p.name, p.category, o.name, o.email, o.phone, o.quantity, formatHu(o.date), o.updatedAt && new Date(o.updatedAt).getTime() !== new Date(o.date).getTime() ? formatHu(o.updatedAt) : '']));
    });

    const buffer = buildXlsx([
      { name: 'Összesítés', rows: summary, widths: [40, 22, 18, 12, 13, 14, 20, 12] },
      { name: 'Jelentkezők', rows: list, widths: [40, 22, 28, 32, 20, 8, 18, 20] },
    ]);

    const date = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Budapest' });
    const base = productId ? `elorendeles_${slug(products[0].name) || 'termek'}` : 'elorendelesek';
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${base}_${date}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('preorder export error:', error);
    return new Response(JSON.stringify({ error: 'Az exportálás nem sikerült.' }), { status: 500 });
  }
}
