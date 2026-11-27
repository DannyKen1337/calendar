import { NextResponse } from 'next/server';
import { logSystemError } from '@/lib/systemLog';
import { getTavernDb } from '@/lib/mongodb';
import { verifyOwner } from '@/lib/auth';
import { buildDbDump } from '@/lib/dbDump';
import { saveToDrive, driveConfigured } from '@/lib/googleDrive';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// „Mentés most a Google Drive-ra” (Rendszer oldal, csak a tulajdonos): a teljes adatbázis (jelszavak és titkos kulcsok
// nélkül) egy JSON-fájlba a Drive mentési mappájába. Ezzel a beállítás is kipróbálható.
export async function POST() {
  try {
    const session = await verifyOwner();
    if (!session) return NextResponse.json({ error: 'Csak a tulajdonos menthet.' }, { status: 403 });
    if (!driveConfigured()) return NextResponse.json({ error: 'A Google Drive-mentés nincs beállítva (lásd docs/google-drive.md).' }, { status: 400 });
    const db = await getTavernDb();
    const name = `tavern-teljes-mentes-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
    let saved;
    try {
      saved = await saveToDrive(db, name, await buildDbDump(db));
    } catch (err) {
      await logSystemError('Drive-mentés', err);
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    await db.collection('audit_logs').insertOne({ adminName: session.username, action: 'ADATBÁZIS MENTÉS', details: `Teljes mentés a Google Drive-ra: ${saved.name}`, date: new Date() });
    return NextResponse.json({ success: true, ...saved });
  } catch (error) {
    console.error('admin-backup error:', error);
    await logSystemError('admin-backup', error);
    return NextResponse.json({ error: 'A mentés most nem sikerült.' }, { status: 500 });
  }
}
