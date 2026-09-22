import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { verifyAdmin, verifyOwner } from '@/lib/auth';

// Naplózó segédfüggvény
async function addLog(db, adminName, action, details) {
  await db.collection('audit_logs').insertOne({
    admin: adminName,
    action,
    details,
    date: new Date()
  });
}

export async function POST(request) {
  try {
    const session = await verifyAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Nincs jogosultságod ehhez a művelethez!' }, { status: 401 });
    }

    const data = await request.json();
    const { action, id, ...updateData } = data;
    
    const client = await clientPromise;
    // A javításunk: Fixen a Tavern adatbázist használjuk
    const db = client.db('Tavern');

    // --- 1. ESEMÉNYEK KEZELÉSE ---
    if (action === 'delete') {
      if (!id) return NextResponse.json({ error: 'Hiányzó ID' }, { status: 400 });
      
      const result = await db.collection('tournaments').deleteOne({ _id: new ObjectId(id) });
      
      if (result.deletedCount === 1) {
        await db.collection('registrations').deleteMany({ tournamentId: id });
        await addLog(db, session.username, 'Törlés', `Esemény törölve (ID: ${id})`);
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ error: 'Az esemény nem található' }, { status: 404 });
    }

    if (action === 'update' || action === 'toggleVisibility') {
      if (!id) return NextResponse.json({ error: 'Hiányzó ID' }, { status: 400 });
      delete updateData._id;

      await db.collection('tournaments').updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );
      
      const logAction = action === 'toggleVisibility' ? 'Láthatóság módosítva' : 'Esemény módosítva';
      await addLog(db, session.username, logAction, `(ID: ${id})`);
      return NextResponse.json({ success: true });
    }

    // --- 2. JELENTKEZÉSEK KEZELÉSE ---
    if (action === 'deleteRegistration') {
      if (!id) return NextResponse.json({ error: 'Hiányzó ID' }, { status: 400 });
      
      const result = await db.collection('registrations').deleteOne({ _id: new ObjectId(id) });
      if (result.deletedCount === 1) {
        await addLog(db, session.username, 'Jelentkezés törölve', `Jelentkező törölve (ID: ${id})`);
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ error: 'Jelentkezés nem található' }, { status: 404 });
    }

    // --- 3. FELHASZNÁLÓK (ADMINOK) KEZELÉSE ---
    if (action === 'deleteUser' || action === 'updateRole') {
      const ownerSession = await verifyOwner();
      if (!ownerSession) {
        return NextResponse.json({ error: 'Csak Tulajdonos módosíthatja a felhasználókat!' }, { status: 403 });
      }

      if (!id) return NextResponse.json({ error: 'Hiányzó ID' }, { status: 400 });

      if (action === 'deleteUser') {
        await db.collection('users').deleteOne({ _id: new ObjectId(id) });
        await addLog(db, session.username, 'Felhasználó törölve', `Admin fiók törölve (ID: ${id})`);
      } else {
        await db.collection('users').updateOne(
          { _id: new ObjectId(id) },
          { $set: { role: updateData.role } }
        );
        await addLog(db, session.username, 'Jogosultság módosítva', `Admin fiók módosítva (ID: ${id}) -> ${updateData.role}`);
      }
      return NextResponse.json({ success: true });
    }

    // --- 4. FEKETELISTA (BLACKLIST) ---
    if (action === 'addBlacklist') {
      const { email, reason } = updateData;
      if (!email) return NextResponse.json({ error: 'Az e-mail cím kötelező' }, { status: 400 });

      await db.collection('blacklist').updateOne(
        { email: email.toLowerCase() },
        { $set: { email: email.toLowerCase(), reason, dateAdded: new Date(), addedBy: session.username } },
        { upsert: true }
      );
      await addLog(db, session.username, 'Feketelista', `${email} hozzáadva a tiltólistához.`);
      return NextResponse.json({ success: true });
    }

    if (action === 'removeBlacklist') {
      if (!id) return NextResponse.json({ error: 'Hiányzó ID' }, { status: 400 });
      await db.collection('blacklist').deleteOne({ _id: new ObjectId(id) });
      await addLog(db, session.username, 'Feketelista', `Eltávolítás a tiltólistáról (ID: ${id})`);
      return NextResponse.json({ success: true });
    }

    // --- 5. BEÁLLÍTÁSOK ---
    if (action === 'toggleMaintenance') {
      const ownerSession = await verifyOwner();
      if (!ownerSession) {
        return NextResponse.json({ error: 'Csak Tulajdonos válthat karbantartási módot!' }, { status: 403 });
      }

      const { isMaintenance } = updateData;
      await db.collection('settings').updateOne(
        { _id: 'global_settings' },
        { $set: { isMaintenance } },
        { upsert: true }
      );

      await addLog(db, session.username, 'Rendszer', `Karbantartás mód: ${isMaintenance ? 'BE' : 'KI'}`);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Ismeretlen művelet' }, { status: 400 });

  } catch (error) {
    console.error("Actions API hiba:", error);
    return NextResponse.json({ error: "Szerverhiba történt: " + error.message }, { status: 500 });
  }
}