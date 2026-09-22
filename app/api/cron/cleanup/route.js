import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  
  // Szigorúbb feltétel, ami nem engedi át, ha hiányzik a környezeti változó
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Jogosulatlan hozzáférés' }, { status: 401 });
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    const allEvents = await db.collection('tournaments').find({}).toArray();
    const oldEventIds = allEvents
      .filter(evt => new Date(evt.date) < twoMonthsAgo)
      .map(evt => evt._id);

    if (oldEventIds.length > 0) {
      await db.collection('tournaments').deleteMany({ _id: { $in: oldEventIds } });
      const stringIds = oldEventIds.map(id => String(id));
      await db.collection('registrations').deleteMany({ tournamentId: { $in: stringIds } });
      
      await db.collection('audit_logs').insertOne({
        adminName: 'Vercel Automata',
        action: 'AUTOMATA TAKARÍTÁS',
        details: `${oldEventIds.length} db 2 hónapnál régebbi esemény törölve.`,
        date: new Date()
      });
    }

    return NextResponse.json({ success: true, deletedCount: oldEventIds.length });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}