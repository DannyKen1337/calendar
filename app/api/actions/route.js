import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { verifyAdmin, verifyOwner } from '@/lib/auth';

async function addLog(db, adminName, action, details) {
  await db.collection('audit_logs').insertOne({
    adminName: adminName || 'Rendszer',
    action,
    details,
    date: new Date()
  });
}

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

    // ==========================================
    // 1. PUBLIKUS MŰVELETEK (NEM KELL ADMIN)
    // ==========================================
    if (actionType === 'JOIN_TOURNAMENT') {
      const { tournamentId, name, email } = payload;
      
      const isBanned = await db.collection('blacklist').findOne({ email: email.toLowerCase() });
      if (isBanned) return NextResponse.json({ error: "A jelentkezés erről az e-mail címről le lett tiltva." }, { status: 403 });

      const tournament = await db.collection('tournaments').findOne(getQuery(tournamentId));
      if (!tournament) return NextResponse.json({ error: "Esemény nem található" }, { status: 404 });
      if (!tournament.is_open) return NextResponse.json({ error: "A jelentkezés lezárult" }, { status: 400 });

      const existing = await db.collection('registrations').findOne({ tournamentId: String(tournamentId), email: email.toLowerCase() });
      if (existing) return NextResponse.json({ error: "Már jelentkeztél erre az eseményre." }, { status: 400 });

      const isQueue = tournament.current_players >= tournament.max_players;
      await db.collection('registrations').insertOne({ tournamentId: String(tournamentId), tournamentName: tournament.name, name, email: email.toLowerCase(), status: isQueue ? 'Várólista' : 'Aktív', date: new Date() });
      await db.collection('tournaments').updateOne(getQuery(tournamentId), { $inc: { [isQueue ? 'queue_count' : 'current_players']: 1 } });
      return NextResponse.json({ success: true, isQueue });
    }

    if (actionType === 'UNSUBSCRIBE_BY_EMAIL') {
      const { tournamentId, email } = payload;
      const reg = await db.collection('registrations').findOne({ tournamentId: String(tournamentId), email: email.toLowerCase() });
      if (!reg) return NextResponse.json({ error: "Nincs regisztráció erről az e-mail címről." }, { status: 404 });
      
      await db.collection('registrations').deleteOne({ _id: reg._id });
      await db.collection('tournaments').updateOne(getQuery(tournamentId), { $inc: { [reg.status === 'Aktív' || reg.status === 'Active' ? 'current_players' : 'queue_count']: -1 } });
      return NextResponse.json({ success: true });
    }

    // ==========================================
    // 2. ADMIN MŰVELETEK (SZIGORÚ ELLENŐRZÉS)
    // ==========================================
    const session = await verifyAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Jogosulatlan hozzáférés!' }, { status: 401 });
    }
    const adminName = session.username; // A szerver a tokenből olvassa ki, nem a kérésből!

    if (actionType === 'ADD_TOURNAMENT') {
      const result = await db.collection('tournaments').insertOne({ ...payload, current_players: 0, queue_count: 0, is_open: true, created_at: new Date() });
      await addLog(db, adminName, 'ÚJ ESEMÉNY', `Létrehozta: ${payload.name}`);
      return NextResponse.json({ success: true, id: result.insertedId });
    }

    if (actionType === 'EDIT_TOURNAMENT') {
      await db.collection('tournaments').updateOne(getQuery(payload.id), { $set: payload });
      await addLog(db, adminName, 'MÓDOSÍTÁS', `Szerkesztette: ${payload.name}`);
      return NextResponse.json({ success: true });
    }

    if (actionType === 'DELETE_TOURNAMENT') {
      const event = await db.collection('tournaments').findOne(getQuery(payload.tournamentId || payload.id));
      await db.collection('tournaments').deleteMany(getQuery(payload.tournamentId || payload.id));
      await db.collection('registrations').deleteMany({ tournamentId: String(payload.tournamentId || payload.id) });
      if (event) await addLog(db, adminName, 'TÖRLÉS', `Törölte az eseményt: ${event.name}`);
      return NextResponse.json({ success: true });
    }

    if (actionType === 'TOGGLE_GATE') {
      const event = await db.collection('tournaments').findOne(getQuery(payload.tournamentId));
      await db.collection('tournaments').updateOne(getQuery(payload.tournamentId), { $set: { is_open: payload.newState } });
      await addLog(db, adminName, 'KAPU NYITÁS/ZÁRÁS', `${payload.newState ? 'Megnyitotta' : 'Lezárta'}: ${event?.name}`);
      return NextResponse.json({ success: true });
    }

    if (actionType === 'REMOVE_REGISTRATION') {
      const reg = await db.collection('registrations').findOne(getQuery(payload.registrationId));
      if (!reg) return NextResponse.json({ error: "Nem található" }, { status: 404 });
      await db.collection('registrations').deleteOne(getQuery(payload.registrationId));
      await db.collection('tournaments').updateOne(getQuery(reg.tournamentId), { $inc: { [reg.status === 'Aktív' || reg.status === 'Active' ? 'current_players' : 'queue_count']: -1 } });
      await addLog(db, adminName, 'JELENTKEZŐ TÖRLÉSE', `Törölte ${reg.name} jelentkezését (${reg.tournamentName})`);
      return NextResponse.json({ success: true });
    }

    // ==========================================
    // 3. TULAJDONOSI (OWNER/GOD MODE) MŰVELETEK
    // ==========================================
    const ownerSession = await verifyOwner();
    if (!ownerSession && ['TOGGLE_ROLE', 'CHANGE_USER_PASSWORD', 'DELETE_USER', 'TOGGLE_MAINTENANCE', 'BAN_EMAIL', 'UNBAN_EMAIL', 'CLEANUP_OLD_EVENTS'].includes(actionType)) {
      return NextResponse.json({ error: 'Tulajdonosi (Owner) jogosultság szükséges!' }, { status: 403 });
    }

    if (actionType === 'TOGGLE_ROLE') {
      await db.collection('users').updateOne(getQuery(payload.targetUserId), { $set: { role: payload.makeAdmin ? 'admin' : 'customer' } });
      await addLog(db, adminName, 'JOGOSULTSÁG', `Jogosultságot módosított egy felhasználónál.`);
      return NextResponse.json({ success: true });
    }

    if (actionType === 'CHANGE_USER_PASSWORD') {
      const hashedPassword = await bcrypt.hash(payload.newPassword, 10);
      await db.collection('users').updateOne(getQuery(payload.userId), { $set: { password: hashedPassword } });
      await addLog(db, adminName, 'JELSZÓ CSERE', `Kicserélte egy fiók jelszavát.`);
      return NextResponse.json({ success: true });
    }

    if (actionType === 'DELETE_USER') {
      await db.collection('users').deleteOne(getQuery(payload.userId));
      await addLog(db, adminName, 'FIÓK TÖRLÉS', `Törölt egy fiókot.`);
      return NextResponse.json({ success: true });
    }

    if (actionType === 'TOGGLE_MAINTENANCE') {
      await db.collection('settings').updateOne({ _id: 'global_settings' }, { $set: { isMaintenance: payload.isMaintenance } }, { upsert: true });
      await addLog(db, adminName, 'RENDSZER', `Karbantartás mód: ${payload.isMaintenance ? 'BEKAPCSOLVA' : 'KIKAPCSOLVA'}`);
      return NextResponse.json({ success: true });
    }

    if (actionType === 'BAN_EMAIL') {
      await db.collection('blacklist').updateOne({ email: payload.email.toLowerCase() }, { $set: { reason: payload.reason, date: new Date() } }, { upsert: true });
      await addLog(db, adminName, 'FEKETELISTA', `Letiltotta: ${payload.email}`);
      return NextResponse.json({ success: true });
    }

    if (actionType === 'UNBAN_EMAIL') {
      await db.collection('blacklist').deleteOne({ email: payload.email.toLowerCase() });
      await addLog(db, adminName, 'FEKETELISTA', `Feloldotta: ${payload.email}`);
      return NextResponse.json({ success: true });
    }

    if (actionType === 'CLEANUP_OLD_EVENTS') {
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      
      const allEvents = await db.collection('tournaments').find({}).toArray();
      const oldEventIds = allEvents.filter(evt => new Date(evt.date) < twoMonthsAgo).map(evt => evt._id);

      if (oldEventIds.length > 0) {
        await db.collection('tournaments').deleteMany({ _id: { $in: oldEventIds } });
        const stringIds = oldEventIds.map(id => String(id));
        await db.collection('registrations').deleteMany({ tournamentId: { $in: stringIds } });
        await addLog(db, adminName, 'TAKARÍTÁS', `${oldEventIds.length} db 2 hónapnál régebbi esemény törölve.`);
      }
      return NextResponse.json({ success: true, count: oldEventIds.length });
    }

    return NextResponse.json({ error: 'Ismeretlen vagy tiltott művelet' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}