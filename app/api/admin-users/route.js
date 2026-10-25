import { NextResponse } from 'next/server';
import { logSystemError } from '@/lib/systemLog';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { getTavernDb } from '@/lib/mongodb';
import { verifyAdmin } from '@/lib/auth';
import { canManageUsers } from '@/lib/permissions';
import { isValidEmail } from '@/lib/rateLimit';
import { effectiveAccess, getGroupsMap, sanitizeGroupInput, usesGroups, groupKind, GROUP_KIND_ORDER, isProtectedGroup, seedDefaultGroups } from '@/lib/userAccess';

export const dynamic = 'force-dynamic';

// Felhasználók és szervezői csoportok kezelése: a tulajdonos, illetve akinek a csoportja a „Felhasználók és csoportok” modult adja.
// Visszaélés elleni védelem nem tulajdonos kezelőnél: a saját fiókját, más felhasználókezelő fiókot, a tulajdonosi fiókot,
// valamint a felhasználókezelést adó csoportot és annak tagságát nem módosíthatja.
// Minden módosítás bekerül a tevékenységnaplóba.

async function verifyUserManager() {
  const session = await verifyAdmin();
  return session && canManageUsers(session) ? session : null;
}

const TEMP_PASSWORD_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const oid = (id) => { const s = String(id ?? ''); return ObjectId.isValid(s) && s.length === 24 ? new ObjectId(s) : null; };

function newTempPassword() {
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let p = '';
  for (let i = 0; i < 12; i++) p += ALPHABET[randomInt(ALPHABET.length)];
  return p;
}

async function addLog(db, adminName, action, details) {
  await db.collection('audit_logs').insertOne({ adminName: adminName || 'Rendszer', action, details, date: new Date() });
}

const groupOut = (g, members) => ({
  id: String(g._id), name: g.name, kind: groupKind(g), protected: isProtectedGroup(g), description: g.description || '', color: g.color,
  allowedCategories: Array.isArray(g.allowedCategories) ? g.allowedCategories : null,
  allowedStores: Array.isArray(g.allowedStores) ? g.allowedStores : null,
  features: g.features || [], members, createdAt: g.createdAt,
});

export async function GET() {
  try {
    const session = await verifyUserManager();
    if (!session) return NextResponse.json({ error: 'Nincs jogosultságod a felhasználók kezeléséhez.' }, { status: 403 });
    const db = await getTavernDb();
    // Az alapcsoportok (játékok, boltok, modulok) egyszeri létrehozása
    const seeded = await seedDefaultGroups(db, session.username).catch(() => 0);
    if (seeded) await addLog(db, session.username, 'CSOPORT', `Alapcsoportok létrehozva: ${seeded} db (játékok, boltok, modulok)`);
    const [users, groupsById] = await Promise.all([
      db.collection('users').find({}, { projection: { password: 0 } }).sort({ username: 1 }).toArray(),
      getGroupsMap(db),
    ]);
    const members = new Map();
    users.forEach(u => (u.groupIds || []).forEach(gid => members.set(String(gid), (members.get(String(gid)) || 0) + 1)));
    return NextResponse.json({
      users: users.map(u => ({
        id: String(u._id), username: u.username, email: u.email, role: u.role,
        groupIds: (u.groupIds || []).map(String), usesGroups: usesGroups(u),
        // Régi, egyénileg beállított jogok (csak amíg a felhasználó nem kap csoportot)
        legacy: usesGroups(u) ? null : { allowedCategories: Array.isArray(u.allowedCategories) ? u.allowedCategories : null, allowedStores: Array.isArray(u.allowedStores) ? u.allowedStores : null, features: u.features || [] },
        access: effectiveAccess(u, groupsById),
        disabled: !!u.disabled, mustChangePassword: !!u.mustChangePassword,
        lastLoginAt: u.lastLoginAt || null, createdAt: u.createdAt || null, createdBy: u.createdBy || '',
      })),
      groups: [...groupsById.values()]
        .sort((a, b) => (GROUP_KIND_ORDER[groupKind(a)] - GROUP_KIND_ORDER[groupKind(b)]) || a.name.localeCompare(b.name, 'hu'))
        .map(g => groupOut(g, members.get(String(g._id)) || 0)),
      isOwner: session.role === 'owner',
    });
  } catch (error) {
    console.error('admin-users GET error:', error);
    await logSystemError('admin-users GET', error);
    return NextResponse.json({ error: 'Adatbázis hiba' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await verifyUserManager();
    if (!session) return NextResponse.json({ error: 'Nincs jogosultságod a felhasználók kezeléséhez.' }, { status: 403 });
    const isOwner = session.role === 'owner';
    const body = await request.json().catch(() => null);
    const { actionType, payload } = body || {};
    if (!payload || typeof payload !== 'object') return NextResponse.json({ error: 'Hiányzó adatok.' }, { status: 400 });
    const db = await getTavernDb();
    const users = db.collection('users');
    const groups = db.collection('user_groups');
    const bad = (error, status = 400, extra = {}) => NextResponse.json({ error, ...extra }, { status });

    // A módosítandó felhasználó (a tulajdonosi fiók innen nem módosítható)
    const loadTarget = async (id) => {
      const o = oid(id);
      const target = o ? await users.findOne({ _id: o }) : null;
      if (!target) return { res: bad('A felhasználó nem található.', 404) };
      if (target.role === 'owner') return { res: bad('A tulajdonosi fiók itt nem módosítható.', 403) };
      if (!isOwner) {
        if (String(target._id) === String(session.id)) return { res: bad('A saját fiókodat nem módosíthatod.', 403) };
        const targetAccess = effectiveAccess(target, await getGroupsMap(db, target.groupIds || []));
        if (targetAccess.features.includes('users')) return { res: bad('Felhasználókezelő fiókot csak a tulajdonos módosíthat.', 403) };
      }
      return { target };
    };
    const protectedDenied = () => bad('A felhasználókezelést adó csoportot csak a tulajdonos kezelheti.', 403);
    // Csak létező csoportok
    const validGroupIds = async (ids) => {
      const list = (Array.isArray(ids) ? ids : []).map(oid).filter(Boolean);
      if (!list.length) return [];
      const found = await groups.find({ _id: { $in: list } }, { projection: { _id: 1, name: 1, features: 1 } }).toArray();
      return found;
    };

    // --- CSOPORTOK ---
    if (actionType === 'SAVE_GROUP') {
      const { group, error } = sanitizeGroupInput(payload);
      if (error) return bad(error);
      const existingId = payload.id ? oid(payload.id) : null;
      if (payload.id && !existingId) return bad('A csoport nem található.', 404);
      if (!isOwner) {
        const before = existingId ? await groups.findOne({ _id: existingId }) : null;
        if (isProtectedGroup(group) || isProtectedGroup(before)) return protectedDenied();
      }
      const dup = await groups.findOne({ name: group.name, ...(existingId ? { _id: { $ne: existingId } } : {}) }, { collation: { locale: 'hu', strength: 1 } });
      if (dup) return bad('Ilyen nevű csoport már van.', 400, { field: 'name' });
      if (existingId) {
        const upd = await groups.updateOne({ _id: existingId }, { $set: { ...group, updatedAt: new Date(), updatedBy: session.username } });
        if (upd.matchedCount === 0) return bad('A csoport nem található.', 404);
        await addLog(db, session.username, 'CSOPORT', `Csoport módosítva: ${group.name}`);
        return NextResponse.json({ success: true, id: String(existingId) });
      }
      const ins = await groups.insertOne({ ...group, createdAt: new Date(), createdBy: session.username });
      await addLog(db, session.username, 'CSOPORT', `Új csoport: ${group.name}`);
      return NextResponse.json({ success: true, id: String(ins.insertedId) });
    }

    if (actionType === 'DELETE_GROUP') {
      const o = oid(payload.id);
      const group = o ? await groups.findOne({ _id: o }) : null;
      if (!group) return bad('A csoport nem található.', 404);
      if (!isOwner && isProtectedGroup(group)) return protectedDenied();
      const affected = await users.updateMany({ groupIds: String(group._id) }, { $pull: { groupIds: String(group._id) } });
      await groups.deleteOne({ _id: group._id });
      await addLog(db, session.username, 'CSOPORT', `Csoport törölve: ${group.name} (${affected.modifiedCount} tag elvesztette a csoport jogait)`);
      return NextResponse.json({ success: true });
    }

    // --- FELHASZNÁLÓK ---
    // Csoportok beállítása: ettől kezdve a jogait csak a csoportjai adják (a régi egyéni jogok törlődnek)
    if (actionType === 'SET_USER_GROUPS') {
      const { target, res } = await loadTarget(payload.userId);
      if (res) return res;
      const found = await validGroupIds(payload.groupIds);
      if (!isOwner && found.some(isProtectedGroup)) return protectedDenied();
      await users.updateOne({ _id: target._id }, {
        $set: { groupIds: found.map(g => String(g._id)), accessMode: 'groups' },
        $unset: { allowedCategories: '', allowedStores: '', features: '' },
      });
      await addLog(db, session.username, 'JOGOSULTSÁG', `${target.username} csoportjai: ${found.map(g => g.name).join(', ') || 'nincs csoport (nem kezelhet semmit)'}`);
      return NextResponse.json({ success: true });
    }

    // Régi egyéni jogok átalakítása csoporttá: azonos beállítású csoportot újrahasznál, különben újat hoz létre
    if (actionType === 'CONVERT_TO_GROUP') {
      const { target, res } = await loadTarget(payload.userId);
      if (res) return res;
      if (usesGroups(target)) return bad('Ez a felhasználó már csoportokat használ.');
      const legacy = effectiveAccess(target, new Map());
      const norm = (l) => (Array.isArray(l) ? [...l].sort().join('|') : '*');
      const all = await groups.find({}).toArray();
      let group = all.find(g => norm(g.allowedCategories) === norm(legacy.allowedCategories) && norm(g.allowedStores) === norm(legacy.allowedStores) && norm(g.features || []) === norm(legacy.features));
      if (!group) {
        let name = `${target.username} jogai`;
        if (all.some(g => g.name.toLowerCase() === name.toLowerCase())) name = `${name} ${all.length + 1}`;
        const doc = { name, description: 'A korábbi egyéni beállításokból készült.', color: '#6b7280', allowedCategories: legacy.allowedCategories, allowedStores: legacy.allowedStores, features: legacy.features, createdAt: new Date(), createdBy: session.username };
        const ins = await groups.insertOne(doc);
        group = { ...doc, _id: ins.insertedId };
      }
      await users.updateOne({ _id: target._id }, { $set: { groupIds: [String(group._id)], accessMode: 'groups' }, $unset: { allowedCategories: '', allowedStores: '', features: '' } });
      await addLog(db, session.username, 'JOGOSULTSÁG', `${target.username} egyéni jogai csoporttá alakítva: ${group.name}`);
      return NextResponse.json({ success: true, groupId: String(group._id), groupName: group.name });
    }

    if (actionType === 'SET_ROLE') {
      const { target, res } = await loadTarget(payload.userId);
      if (res) return res;
      const role = payload.role === 'admin' ? 'admin' : 'customer';
      await users.updateOne({ _id: target._id }, { $set: { role } });
      await addLog(db, session.username, 'JOGOSULTSÁG', `${target.username} szerepe: ${role === 'admin' ? 'szervező' : 'játékos'}`);
      return NextResponse.json({ success: true });
    }

    // Felfüggesztés: a fiók nem törlődik, de nem tud belépni, és a meglévő munkamenete is azonnal érvényét veszti
    if (actionType === 'SET_DISABLED') {
      const { target, res } = await loadTarget(payload.userId);
      if (res) return res;
      const disabled = payload.disabled === true;
      await users.updateOne({ _id: target._id }, disabled ? { $set: { disabled: true, disabledAt: new Date(), disabledBy: session.username } } : { $unset: { disabled: '', disabledAt: '', disabledBy: '' } });
      await addLog(db, session.username, 'FIÓK', `${target.username} ${disabled ? 'felfüggesztve' : 'visszaengedve'}`);
      return NextResponse.json({ success: true });
    }

    // Új ideiglenes jelszó: a felhasználó első belépéskor saját jelszót állít be (7 napig érvényes)
    if (actionType === 'RESET_PASSWORD') {
      const { target, res } = await loadTarget(payload.userId);
      if (res) return res;
      const tempPassword = newTempPassword();
      const expiresAt = new Date(Date.now() + TEMP_PASSWORD_TTL_MS);
      await users.updateOne({ _id: target._id }, { $set: { password: await bcrypt.hash(tempPassword, 10), mustChangePassword: true, tempPasswordExpires: expiresAt } });
      await addLog(db, session.username, 'JELSZÓ', `${target.username}: új ideiglenes jelszó`);
      return NextResponse.json({ success: true, username: target.username, email: target.email, tempPassword, expiresAt });
    }

    if (actionType === 'CREATE_USER') {
      const username = String(payload.username ?? '').trim();
      const email = String(payload.email ?? '').trim().toLowerCase();
      const role = payload.role === 'customer' ? 'customer' : 'admin';
      if (!/^[\p{L}\p{N}._-]{3,32}$/u.test(username)) return bad('A felhasználónév 3-32 karakter lehet (betű, szám, pont, aláhúzás, kötőjel).', 400, { field: 'username' });
      if (!isValidEmail(email)) return bad('Érvényes e-mail címet adj meg.', 400, { field: 'email' });
      if (await users.findOne({ email })) return bad('Ezzel az e-mail címmel már van fiók.', 400, { field: 'email' });
      if (await users.findOne({ username }, { collation: { locale: 'en', strength: 2 } })) return bad('Ez a felhasználónév már foglalt.', 400, { field: 'username' });
      const found = role === 'admin' ? await validGroupIds(payload.groupIds) : [];
      if (!isOwner && found.some(isProtectedGroup)) return protectedDenied();
      const tempPassword = newTempPassword();
      const expiresAt = new Date(Date.now() + TEMP_PASSWORD_TTL_MS);
      await users.insertOne({
        username, email, role, password: await bcrypt.hash(tempPassword, 10), mustChangePassword: true, tempPasswordExpires: expiresAt,
        groupIds: found.map(g => String(g._id)), accessMode: 'groups', createdAt: new Date(), createdBy: session.username,
      });
      await addLog(db, session.username, 'ÚJ FELHASZNÁLÓ', `${username} (${role === 'admin' ? 'szervező' : 'játékos'})${found.length ? `, csoportok: ${found.map(g => g.name).join(', ')}` : ''}`);
      return NextResponse.json({ success: true, username, email, tempPassword, expiresAt });
    }

    if (actionType === 'DELETE_USER') {
      const { target, res } = await loadTarget(payload.userId);
      if (res) return res;
      await users.deleteOne({ _id: target._id });
      await addLog(db, session.username, 'FIÓK TÖRLÉS', `${target.username} (${target.email}) törölve`);
      return NextResponse.json({ success: true });
    }

    return bad('Ismeretlen művelet.');
  } catch (error) {
    console.error('admin-users POST error:', error);
    await logSystemError('admin-users POST', error);
    return NextResponse.json({ error: 'A művelet nem sikerült.' }, { status: 500 });
  }
}
