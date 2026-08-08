import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request) {
  try {
    const body = await request.json();
    const { actionType, payload } = body;
    const client = await clientPromise;
    const db = client.db(); 

    const getQuery = (id) => {
      try { return { $or: [{ id: String(id) }, { _id: new ObjectId(id) }] }; }
      catch { return { id: String(id) }; }
    };

    if (actionType === 'ADD_TOURNAMENT') {
      const result = await db.collection('tournaments').insertOne({ ...payload, current_players: 0, queue_count: 0, is_open: true, created_at: new Date() });
      return NextResponse.json({ success: true, id: result.insertedId });
    }

    if (actionType === 'EDIT_TOURNAMENT') {
      await db.collection('tournaments').updateOne(getQuery(payload.id), { $set: payload });
      return NextResponse.json({ success: true });
    }

    if (actionType === 'DELETE_TOURNAMENT') {
      await db.collection('tournaments').deleteMany(getQuery(payload.tournamentId || payload.id));
      await db.collection('registrations').deleteMany({ tournamentId: String(payload.tournamentId || payload.id) });
      return NextResponse.json({ success: true });
    }

    if (actionType === 'TOGGLE_GATE') {
      await db.collection('tournaments').updateOne(getQuery(payload.tournamentId), { $set: { is_open: payload.newState } });
      return NextResponse.json({ success: true });
    }

    if (actionType === 'TOGGLE_ROLE') {
      const targetId = payload.targetUserId;
      await db.collection('users').updateOne(
        getQuery(targetId), 
        { $set: { role: payload.makeAdmin ? 'admin' : 'customer' } }
      );
      return NextResponse.json({ success: true });
    }

    if (actionType === 'JOIN_TOURNAMENT') {
      const { tournamentId, name, email } = payload;
      const tournament = await db.collection('tournaments').findOne(getQuery(tournamentId));
      if (!tournament) return NextResponse.json({ error: "Esemény nem található" }, { status: 404 });
      if (!tournament.is_open) return NextResponse.json({ error: "A jelentkezés lezárult" }, { status: 400 });

      const existing = await db.collection('registrations').findOne({ tournamentId: String(tournamentId), email });
      if (existing) return NextResponse.json({ error: "Már jelentkeztél" }, { status: 400 });

      const isQueue = tournament.current_players >= tournament.max_players;
      await db.collection('registrations').insertOne({ tournamentId: String(tournamentId), tournamentName: tournament.name, name, email, status: isQueue ? 'Várólista' : 'Aktív', date: new Date() });
      await db.collection('tournaments').updateOne(getQuery(tournamentId), { $inc: { [isQueue ? 'queue_count' : 'current_players']: 1 } });
      return NextResponse.json({ success: true, isQueue });
    }

    // --- ÚJ FUNKCIÓ: LEIRATKOZÁS E-MAIL CÍMMEL ---
    if (actionType === 'UNSUBSCRIBE_BY_EMAIL') {
      const { tournamentId, email } = payload;
      
      const reg = await db.collection('registrations').findOne({ tournamentId: String(tournamentId), email });
      if (!reg) {
        return NextResponse.json({ error: "Nem találtunk jelentkezést ezzel az e-mail címmel!" }, { status: 404 });
      }
      
      await db.collection('registrations').deleteOne({ _id: reg._id });
      await db.collection('tournaments').updateOne(
        getQuery(tournamentId),
        { $inc: { [reg.status === 'Aktív' ? 'current_players' : 'queue_count']: -1 } }
      );
      
      return NextResponse.json({ success: true });
    }

    if (actionType === 'REMOVE_REGISTRATION') {
      const reg = await db.collection('registrations').findOne(getQuery(payload.registrationId));
      if (!reg) return NextResponse.json({ error: "Nem található" }, { status: 404 });
      await db.collection('registrations').deleteOne(getQuery(payload.registrationId));
      await db.collection('tournaments').updateOne(getQuery(reg.tournamentId), { $inc: { [reg.status === 'Aktív' ? 'current_players' : 'queue_count']: -1 } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}