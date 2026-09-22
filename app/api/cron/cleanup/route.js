import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Jogosulatlan hozzáférés' }, { status: 401 });
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    
    // Kiszámoljuk a pontos 2 hónappal ezelőtti dátumot
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    const allEvents = await db.collection('tournaments').find({}).toArray();
    const oldEventIds = allEvents
      .filter(evt => new Date(evt.date) < twoMonthsAgo)
      .map(evt => evt._id);

    if (oldEventIds.length > 0) {
      // Töröljük a régi eseményeket
      await db.collection('tournaments').deleteMany({ _id: { $in: oldEventIds } });
      
      // Töröljük a hozzájuk tartozó regisztrációkat is
      const stringIds = oldEventIds.map(id => String(id));
      await db.collection('registrations').deleteMany({ tournamentId: { $in: stringIds } });
      
      // Naplózzuk az automata akciót
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