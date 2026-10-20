import { getTavernDb } from '@/lib/mongodb';
import { verifyAdmin } from '@/lib/auth';
import { canManageCategory, hasFeature } from '@/lib/permissions';
import { toObjectId } from '@/lib/preorderData';
import { groupByGame, productStock, productLimit, productPrice } from '@/lib/preorders';
import { buildXlsx } from '@/lib/xlsx';

export const dynamic = 'force-dynamic';

const formatHu = (d) => (d ? new Date(d).toLocaleString('hu-HU', { timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase().slice(0, 40);

// Előrendelések Excel-ben: ?productId=... egy termék, ?category=... egy játék termékei, egyébként az összes kezelhető termék.
// Két munkalap: összesítés termékenként (rendeléshez) és a jelentkezők listája.
export async function GET(request) {
  try {
    const session = await verifyAdmin();
    if (!session) return new Response(JSON.stringify({ error: 'Jogosulatlan hozzáférés' }), { status: 401 });
    if (!hasFeature(session, 'preorders')) return new Response(JSON.stringify({ error: 'Nincs jogosultságod az előrendelésekhez.' }), { status: 403 });

    const params = new URL(request.url).searchParams;
    const productId = params.get('productId');
    const category = params.get('category');
    const db = await getTavernDb();
    const query = {};
    if (category) {
      if (!canManageCategory(session, category)) return new Response(JSON.stringify({ error: 'Ennek a játéknak a termékeit nem kezelheted.' }), { status: 403 });
      query.category = category;
    }
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

    // Az árak és összegek forintban, számként (az Excelben összeadhatók)
    // A jelentkezők termékenként név szerinti (ábécé) sorrendben – az átadás nem változtat a sorrenden, csak az „Átadva” oszlopon
    const summary = [['Termék', 'Játék', 'Megjelenés', 'Állapot', 'Ár (Ft)', 'Jelentkezők', 'Összes darab', 'Várható összeg (Ft)', 'Elérhető mennyiség', 'Limit / fő', 'Fizetve (jelentkező)', 'Befizetve (Ft)', 'Átadva (jelentkező)']];
    const list = [['Termék', 'Játék', 'Név', 'E-mail', 'Telefon', 'Darab', 'Ár (Ft)', 'Összeg (Ft)', 'Leadva', 'Utoljára módosítva', 'Fizetve', 'Fizetést rögzítette', 'Átadva', 'Átadta']];
    const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'hu', { sensitivity: 'base' });
    ordered.forEach(p => {
      const rows = [...byProduct.get(String(p._id))].sort(byName);
      const price = productPrice(p);
      const qty = rows.reduce((s, o) => s + (o.quantity || 0), 0);
      summary.push([p.name, p.category, p.releaseDate || '', p.isOpen ? 'Nyitott' : 'Lezárva', price ?? '', rows.length, qty, price !== null ? price * qty : '', productStock(p) ?? 'nincs megadva', productLimit(p) || 'korlátlan', `${rows.filter(o => o.paidAt).length} / ${rows.length}`, price !== null ? price * rows.filter(o => o.paidAt).reduce((s, o) => s + (o.quantity || 0), 0) : '', `${rows.filter(o => o.handedOverAt).length} / ${rows.length}`]);
      rows.forEach(o => list.push([p.name, p.category, o.name, o.email, o.phone, o.quantity, price ?? '', price !== null ? price * (o.quantity || 0) : '', formatHu(o.date), o.updatedAt && new Date(o.updatedAt).getTime() !== new Date(o.date).getTime() ? formatHu(o.updatedAt) : '', o.paidAt ? formatHu(o.paidAt) : '', o.paidBy || '', o.handedOverAt ? formatHu(o.handedOverAt) : '', o.handedOverBy || '']));
    });

    const buffer = buildXlsx([
      { name: 'Összesítés', rows: summary, widths: [40, 22, 18, 12, 12, 13, 14, 20, 20, 12, 18, 16, 18] },
      { name: 'Jelentkezők', rows: list, widths: [40, 22, 28, 32, 20, 8, 12, 14, 18, 20, 18, 18, 18, 16] },
    ]);

    const date = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Budapest' });
    const base = productId ? `elorendeles_${slug(products[0].name) || 'termek'}` : category ? `elorendelesek_${slug(category) || 'jatek'}` : 'elorendelesek';
    await db.collection('audit_logs').insertOne({
      adminName: session.username, action: 'ELŐRENDELÉS EXPORT',
      details: `Excel letöltés: ${productId ? products[0].name : category || 'összes termék'} (${list.length - 1} jelentkezés)`,
      date: new Date(),
    });
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
