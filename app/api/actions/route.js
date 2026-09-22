import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
// Behozzuk a stabil hitelesítést!
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
    
    // 1. Publikus akciók (Jelentkezés, Leiratkozás) - Ezekhez nem kell belépni
    const isPublicAction = actionType === 'JOIN_TOURNAMENT' || actionType === 'UNSUBSCRIBE_BY_EMAIL';
    
    // BIZTONSÁG: Ha nem publikus akció, akkor ellenőrizzük, hogy be van-e lépve az admin!
    let session = null;
    if (!isPublicAction) {
      session = await verifyAdmin();
      if (!session) {
        return NextResponse.json({ error: 'Nincs jogosultságod a művelethez!' }, { status: 401 });
      }
    }

    const client = await clientPromise;
    // JAVÍTÁS: Kifejezetten a Tavern adatbázist célozzuk
    const db = client.db('Tavern');

    const getQuery = (id) => {
      try { return { $or: [{ id: String(id) }, { _id: new ObjectId(id) }] }; }
      catch { return { id: String(id) }; }
    };

    // --- ESEMÉNYEK ---
    if (actionType === 'ADD_TOURNAMENT') {
      const result = await db.collection('tournaments').insertOne({ 
        ...payload, 
        current_players: 0, 
        queue_count: 0, 
        is_open: true, 
        created_at: new Date() 
      });
      await addLog(db, session.username, 'ÚJ ESEMÉNY', `Létrehozta: ${payload.name}`);
      return NextResponse.json({ success: true, id: result.insertedId });
    }

    if (actionType === 'EDIT_TOURNAMENT') {
      await db.collection('tournaments').updateOne(getQuery(payload.id), { $set: payload });
      await addLog(db, session.username, 'MÓDOSÍTÁS', `Szerkesztette: ${payload.name}`);
      return NextResponse.json({ success: true });
    }

    if (actionType === 'DELETE_TOURNAMENT') {
      const event = await db.collection('tournaments').findOne(getQuery(payload.tournamentId || payload.id));
      await db.collection('tournaments').deleteMany(getQuery(payload.tournamentId || payload.id));
      await db.collection('registrations').deleteMany({ tournamentId: String(payload.tournamentId || payload.id) });
      if (event) await addLog(db, session.username, 'TÖRLÉS', `Törölte az eseményt: ${event.name}`);
      return NextResponse.json({ success: true });
    }

    if (actionType === 'TOGGLE_GATE') {
      const event = await db.collection('tournaments').findOne(getQuery(payload.tournamentId));
      await db.collection('tournaments').updateOne(getQuery(payload.tournamentId), { $set: { is_open: payload.newState } });
      await addLog(db, session.username, 'KAPU NYITÁS/ZÁRÁS', `${payload.newState ? 'Megnyitotta' : 'Lezárta'}: ${event?.name}`);
      return NextResponse.json({ success: true });
    }

    if (actionType === 'CLEANUP_OLD_EVENTS') {
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
        await addLog(db, session.username, 'TAKARÍTÁS', `${oldEventIds.length} db 2 hónapnál régebbi esemény törölve.`);
      }
      return NextResponse.json({ success: true, count: oldEventIds.length });
    }

    // --- PUBLIKUS AKCIÓK (JELENTKEZŐKNEK) ---
    if (actionType === 'JOIN_TOURNAMENT') {
      const { tournamentId, name, email } = payload;
      
      const isBanned = await db.collection('blacklist').findOne({ email: email.toLowerCase() });
      if (isBanned) {
        return NextResponse.json({ error: "Sajnáljuk, de erről az e-mail címről a jelentkezés letiltásra került a Tavern rendszerében." }, { status: 403 });
      }

      const tournament = await db.collection('tournaments').findOne(getQuery(tournamentId));
      if (!tournament) return NextResponse.json({ error: "Esemény nem található" }, { status: 404 });
      if (!tournament.is_open) return NextResponse.json({ error: "A jelentkezés lezárult" }, { status: 400 });

      const existing = await db.collection('registrations').findOne({ tournamentId: String(tournamentId), email: email.toLowerCase() });
      if (existing) return NextResponse.json({ error: "Már jelentkeztél" }, { status: 400 });

      const isQueue = tournament.current_players >= tournament.max_players;
      await db.collection('registrations').insertOne({ tournamentId: String(tournamentId), tournamentName: tournament.name, name, email: email.toLowerCase(), status: isQueue ? 'Várólista' : 'Aktív', date: new Date() });
      await db.collection('tournaments').updateOne(getQuery(tournamentId), { $inc: { [isQueue ? 'queue_count' : 'current_players']: 1 } });
      return NextResponse.json({ success: true, isQueue });
    }

    if (actionType === 'UNSUBSCRIBE_BY_EMAIL') {
      const { tournamentId, email } = payload;
      const reg = await db.collection('registrations').findOne({ tournamentId: String(tournamentId), email: email.toLowerCase() });
      if (!reg) return NextResponse.json({ error: "Nincs jelentkezés erről az e-mail címről." }, { status: 404 });
      
      await db.collection('registrations').deleteOne({ _id: reg._id });
      await db.collection('tournaments').updateOne(getQuery(tournamentId), { $inc: { [reg.status === 'Aktív' || reg.status === 'Active' ? 'current_players' : 'queue_count']: -1 } });
      return NextResponse.json({ success: true });
    }

    // --- JELENTKEZÉSEK KEZELÉSE (ADMIN) ---
    if (actionType === 'REMOVE_REGISTRATION') {
      const reg = await db.collection('registrations').findOne(getQuery(payload.registrationId));
      if (!reg) return NextResponse.json({ error: "Nem található" }, { status: 404 });
      await db.collection('registrations').deleteOne(getQuery(payload.registrationId));
      await db.collection('tournaments').updateOne(getQuery(reg.tournamentId), { $inc: { [reg.status === 'Aktív' || reg.status === 'Active' ? 'current_players' : 'queue_count']: -1 } });
      await addLog(db, session.username, 'JELENTKEZŐ TÖRLÉSE', `Törölte ${reg.name} jelentkezését (${reg.tournamentName})`);
      return NextResponse.json({ success: true });
    }

    // --- FELHASZNÁLÓK (OWNER ONLY) ---
    if (actionType === 'TOGGLE_ROLE' || actionType === 'DELETE_USER') {
      const ownerSession = await verifyOwner();
      if (!ownerSession) return NextResponse.json({ error: 'Csak Tulajdonos módosíthatja a fiókokat!' }, { status: 403 });

      if (actionType === 'TOGGLE_ROLE') {
        await db.collection('users').updateOne(getQuery(payload.targetUserId), { $set: { role: payload.makeAdmin ? 'admin' : 'customer' } });
        await addLog(db, session.username, 'JOGOSULTSÁG', `Jogosultságot módosított egy felhasználónál.`);
      } else {
        await db.collection('users').deleteOne(getQuery(payload.userId));
        await addLog(db, session.username, 'FIÓK TÖRLÉS', `Törölt egy fiókot.`);
      }
      return NextResponse.json({ success: true });
    }

    if (actionType === 'CHANGE_USER_PASSWORD') {
      const ownerSession = await verifyOwner();
      if (!ownerSession) return NextResponse.json({ error: 'Csak Tulajdonos cserélhet jelszót!' }, { status: 403 });

      const hashedPassword = await bcrypt.hash(payload.newPassword, 10);
      await db.collection('users').updateOne(getQuery(payload.userId), { $set: { password: hashedPassword } });
      await addLog(db, session.username, 'JELSZÓ CSERE', `Kicserélte egy fiók jelszavát.`);
      return NextResponse.json({ success: true });
    }

    if (actionType === 'CHANGE_OWN_PASSWORD') {
      const ownerSession = await verifyOwner();
      if (!ownerSession) {
        return NextResponse.json({ error: 'Csak Admin2 módosíthatja a saját jelszavát.' }, { status: 403 });
      }

      const { currentPassword, newPassword } = payload;
      if (!currentPassword || !newPassword) {
        return NextResponse.json({ error: 'A jelenlegi és az új jelszó megadása kötelező.' }, { status: 400 });
      }
      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'Az új jelszónak legalább 6 karakter hosszúnak kell lennie.' }, { status: 400 });
      }

      const user = await db.collection('users').findOne(getQuery(ownerSession.id));
      if (!user) return NextResponse.json({ error: 'Felhasználó nem található.' }, { status: 404 });

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) return NextResponse.json({ error: 'A jelenlegi jelszó hibás.' }, { status: 400 });

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.collection('users').updateOne(getQuery(ownerSession.id), { $set: { password: hashedPassword } });
      await addLog(db, session.username, 'SAJÁT JELSZÓ CSERE', 'Megváltoztatta a saját jelszavát.');
      return NextResponse.json({ success: true });
    }

    // --- RENDSZER BEÁLLÍTÁSOK ÉS TILTÓLISTA ---
    if (actionType === 'TOGGLE_MAINTENANCE') {
      const ownerSession = await verifyOwner();
      if (!ownerSession) return NextResponse.json({ error: 'Csak Tulajdonos válthat karbantartási módot!' }, { status: 403 });

      await db.collection('settings').updateOne({ _id: 'global_settings' }, { $set: { isMaintenance: payload.isMaintenance } }, { upsert: true });
      await addLog(db, session.username, 'RENDSZER', `Karbantartás mód: ${payload.isMaintenance ? 'BEKAPCSOLVA' : 'KIKAPCSOLVA'}`);
      return NextResponse.json({ success: true });
    }

    if (actionType === 'BAN_EMAIL') {
      await db.collection('blacklist').updateOne({ email: payload.email.toLowerCase() }, { $set: { reason: payload.reason, date: new Date() } }, { upsert: true });
      await addLog(db, session.username, 'FEKETELISTA', `Letiltotta: ${payload.email}`);
      return NextResponse.json({ success: true });
    }

    if (actionType === 'UNBAN_EMAIL') {
      await db.collection('blacklist').deleteOne({ email: payload.email.toLowerCase() });
      await addLog(db, session.username, 'FEKETELISTA', `Feloldotta: ${payload.email}`);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}