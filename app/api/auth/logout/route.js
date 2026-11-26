import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';
import { getCurrentUser, bumpSessionVersion, SESSION_COOKIE } from '@/lib/auth';
import { getTavernDb } from '@/lib/mongodb';

// Kijelentkezés. { everywhere: true }: minden eszközről (a munkamenet-verzió nő, így a többi eszköz sütije is érvénytelen lesz)
export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (body?.everywhere === true) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Nincs bejelentkezve.' }, { status: 401 });
    const db = await getTavernDb();
    await db.collection('users').updateOne({ _id: new ObjectId(String(user.id)) }, bumpSessionVersion);
    await db.collection('audit_logs').insertOne({ adminName: user.username, action: 'KIJELENTKEZÉS', details: 'Kijelentkezett minden eszközről.', date: new Date() });
  }
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  return NextResponse.json({ success: true });
}
