import { NextResponse } from 'next/server';
import { getTavernDb } from '@/lib/mongodb';
import { verifyAdmin } from '@/lib/auth';
import { canManageCategory } from '@/lib/permissions';
import { publicName } from '@/lib/attendance';

export const dynamic = 'force-dynamic';

// Statisztika a check-in előzményekből (attendance_history, 1 évig őrizzük).
// A szervező csak azoknak a játékoknak az adatait kapja, amelyeket kezelhet (a jelentkezők adataihoz hasonlóan).
// Tömör sorokat küldünk, a szűrés és az összesítés a böngészőben történik; e-mail cím nem kerül ki.
export async function GET() {
  try {
    const session = await verifyAdmin();
    if (!session) return NextResponse.json({ error: 'Jogosulatlan hozzáférés' }, { status: 401 });

    const db = await getTavernDb();
    const history = await db.collection('attendance_history')
      .find({}, { projection: { email: 1, name: 1, username: 1, tournamentId: 1, tournamentName: 1, category: 1, eventDate: 1, attended: 1 } })
      .toArray();

    // Játékos azonosítása: e-mail cím, ennek hiányában (admin által felvett, e-mail nélküli versenyző) a név
    const playerIndex = new Map();
    const players = [];
    const rows = [];
    history.forEach(h => {
      const category = h.category || 'Egyéb';
      if (!canManageCategory(session, category)) return;
      const key = h.email ? `e:${h.email}` : `n:${String(h.username || h.name || '').toLowerCase()}`;
      if (key === 'n:') return;
      if (!playerIndex.has(key)) {
        playerIndex.set(key, players.length);
        players.push({ name: publicName(h) || 'Ismeretlen', fullName: h.name || '' });
      }
      const month = String(h.eventDate || '').slice(0, 7);
      rows.push({
        m: /^\d{4}-\d{2}$/.test(month) ? month : null,
        c: category,
        p: playerIndex.get(key),
        e: String(h.tournamentId || ''),
        a: h.attended === true,
      });
    });

    return NextResponse.json({ players, rows });
  } catch (error) {
    console.error('admin-stats error:', error);
    return NextResponse.json({ error: 'Adatbázis hiba' }, { status: 500 });
  }
}
