import { NextResponse } from 'next/server';
import { getTavernDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { randomInt, randomBytes } from 'crypto';
import { verifyAdmin, verifyOwner } from '@/lib/auth';
import { consumeRateLimit, isValidEmail } from '@/lib/rateLimit';
import { canManageCategory, canManageEvent, sanitizeCategories } from '@/lib/permissions';
import { isMailConfigured, sendMail, appUrl, escapeHtml, mailLayout, mailButton } from '@/lib/mailer';

const TEMP_PASSWORD_TTL_MS = 7 * 24 * 60 * 60 * 1000; // az ideiglenes jelszó 7 napig érvényes

const TOURNAMENT_EDIT_FIELDS = [
  'name', 'store', 'category', 'date', 'max_players', 'external_url',
  'description', 'imageUrl', 'isExternalEvent', 'color', 'isFeatured', 'isOpenAttendance',
];

// Kötetlen létszámú esemény: nincs max. létszám, nincs jelentkezés, nincs külső jelentkezési link
function applyOpenAttendance(doc) {
  if (doc.isOpenAttendance === true) {
    doc.max_players = 0;
    doc.external_url = '';
    doc.isExternalEvent = false;
  }
  return doc;
}

// Csak http(s) link mentődhet el (pl. "javascript:" link ne futhasson le a látogatónál)
const safeUrl = (value) => {
  let s = String(value ?? '').trim();
  if (!s) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s}`; // "www.pelda.hu" => "https://www.pelda.hu"
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : '';
  } catch {
    return '';
  }
};

function pickTournamentFields(source) {
  const doc = {};
  for (const key of TOURNAMENT_EDIT_FIELDS) {
    if (source[key] !== undefined) doc[key] = source[key];
  }
  if (doc.external_url !== undefined) doc.external_url = safeUrl(doc.external_url);
  if (doc.imageUrl !== undefined) doc.imageUrl = safeUrl(doc.imageUrl);
  return doc;
}

const isActiveStatus = (status) => status === 'Aktív' || status === 'Active';

// Felszabadult helyekre a várólista legkorábbi jelentkezői lépnek elő (leiratkozás, jelentkező törlése, létszámemelés után).
// Előbb atomikusan foglal helyet az eseményen, csak utána állítja át a jelentkezést, így párhuzamos kérésnél sem lépi túl a max. létszámot.
async function promoteFromQueue(db, tournamentId) {
  const tournaments = db.collection('tournaments');
  const registrations = db.collection('registrations');
  const tId = String(tournamentId);
  let tQuery;
  try { tQuery = { $or: [{ id: tId }, { _id: new ObjectId(tId) }] }; } catch { tQuery = { id: tId }; }
  const promoted = [];

  for (let i = 0; i < 500; i++) {
    const next = await registrations.findOne({ tournamentId: tId, status: { $nin: ['Aktív', 'Active'] } }, { sort: { date: 1 } });
    if (!next) break;

    const seat = await tournaments.findOneAndUpdate(
      { $and: [tQuery, { isOpenAttendance: { $ne: true } }, { $expr: { $lt: ['$current_players', '$max_players'] } }] },
      [{ $set: { current_players: { $add: ['$current_players', 1] }, queue_count: { $max: [0, { $subtract: ['$queue_count', 1] }] } } }]
    );
    if (!seat) break; // nincs szabad hely

    const updated = await registrations.updateOne({ _id: next._id, status: next.status }, { $set: { status: 'Aktív', promotedAt: new Date() } });
    if (updated.modifiedCount !== 1) {
      // Közben valaki más módosította ezt a jelentkezést (pl. leiratkozott): a lefoglalt helyet visszaadjuk
      await tournaments.updateOne(tQuery, [{ $set: { current_players: { $max: [0, { $subtract: ['$current_players', 1] }] }, queue_count: { $add: ['$queue_count', 1] } } }]);
      continue;
    }
    promoted.push(next.name);
  }
  return promoted;
}

async function addLog(db, adminName, action, details) {
  await db.collection('audit_logs').insertOne({
    adminName: adminName || 'Rendszer',
    action,
    details,
    date: new Date()
  });
}

// Jelentkezés törlése + számláló csökkentése + várólista előléptetés (leiratkozás és admin törlés közös része)
async function removeRegistration(db, reg) {
  const deleted = await db.collection('registrations').deleteOne({ _id: reg._id });
  if (deleted.deletedCount !== 1) return; // párhuzamos kérés már törölte
  const tId = String(reg.tournamentId);
  let tQuery;
  try { tQuery = { $or: [{ id: tId }, { _id: new ObjectId(tId) }] }; } catch { tQuery = { id: tId }; }
  const isActive = isActiveStatus(reg.status);
  const counterField = isActive ? 'current_players' : 'queue_count';
  await db.collection('tournaments').updateOne(
    { $and: [tQuery, { [counterField]: { $gt: 0 } }] },
    { $inc: { [counterField]: -1 } }
  );
  if (isActive) {
    const promoted = await promoteFromQueue(db, tId);
    if (promoted.length > 0) await addLog(db, 'Rendszer', 'VÁRÓLISTA', `Előléptetve (${reg.tournamentName}): ${promoted.join(', ')}`);
  }
}

const newCancelToken = () => randomBytes(24).toString('base64url');
const cancelLink = (request, token) => `${appUrl(request)}/leiratkozas?token=${encodeURIComponent(token)}`;

function formatHuDate(dateStr) {
  const m = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/);
  return m ? `${m[1]}. ${m[2]}. ${m[3]}. ${m[4]}` : String(dateStr || '');
}

// Visszaigazolás jelentkezéskor: ha valaki más e-mail címével jelentkezett, a tulajdonos egy kattintással törölheti
async function sendJoinMail(request, { email, name, tournament, isQueue, token }) {
  const html = mailLayout('Jelentkezés visszaigazolása', `
    <p>Kedves ${escapeHtml(name)}!</p>
    <p>${isQueue ? '<b>Várólistára</b> kerültél' : 'Sikeresen <b>jelentkeztél</b>'} erre az eseményre:</p>
    <p style="font-size:18px;color:#E5B15D"><b>${escapeHtml(tournament.name)}</b><br><span style="color:#baaaac">${escapeHtml(formatHuDate(tournament.date))}</span></p>
    ${isQueue ? '<p>Ha felszabadul egy hely, automatikusan előlépsz – ezt a naptárban látod.</p>' : ''}
    <p>Ha mégsem tudsz jönni, vagy nem te jelentkeztél, itt leiratkozhatsz:</p>
    ${mailButton(cancelLink(request, token), 'Leiratkozás')}
  `);
  await sendMail({ to: email, subject: `Jelentkezés: ${tournament.name}`, html });
}

async function sendUnsubscribeMail(request, { email, reg, token }) {
  const html = mailLayout('Leiratkozás megerősítése', `
    <p>Leiratkozást kértek erről az e-mail címről a(z) <b>${escapeHtml(reg.tournamentName)}</b> eseményről.</p>
    <p>A leiratkozáshoz kattints az alábbi gombra. Ha nem te kérted, hagyd figyelmen kívül ezt a levelet – a jelentkezésed megmarad.</p>
    ${mailButton(cancelLink(request, token), 'Leiratkozás megerősítése')}
  `);
  await sendMail({ to: email, subject: `Leiratkozás megerősítése: ${reg.tournamentName}`, html });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { actionType, payload } = body;
    
    // 1. Publikus akciók (Jelentkezés, Leiratkozás) - Ezekhez nem kell belépni
    const isPublicAction = actionType === 'JOIN_TOURNAMENT' || actionType === 'UNSUBSCRIBE_BY_EMAIL' || actionType === 'UNSUBSCRIBE_BY_TOKEN';
    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'Hiányzó adatok.' }, { status: 400 });
    }
    
    // BIZTONSÁG: Ha nem publikus akció, akkor ellenőrizzük, hogy be van-e lépve az admin!
    let session = null;
    if (!isPublicAction) {
      session = await verifyAdmin();
      if (!session) {
        return NextResponse.json({ error: 'Nincs jogosultságod a művelethez!' }, { status: 401 });
      }
    }

    const db = await getTavernDb();

    const getQuery = (id) => {
      try { return { $or: [{ id: String(id) }, { _id: new ObjectId(id) }] }; }
      catch { return { id: String(id) }; }
    };

    const noPermission = () => NextResponse.json({ error: 'Ennek a játéknak az eseményeit nem kezelheted.' }, { status: 403 });

    // --- ESEMÉNYEK ---
    if (actionType === 'ADD_TOURNAMENT') {
      const doc = applyOpenAttendance(pickTournamentFields(payload));
      if (!doc.name || !doc.category || !doc.date) {
        return NextResponse.json({ error: 'Hiányzó kötelező mezők (név, kategória, dátum).' }, { status: 400 });
      }
      if (!canManageCategory(session, doc.category)) return noPermission();
      const result = await db.collection('tournaments').insertOne({
        ...doc,
        current_players: 0,
        queue_count: 0,
        is_open: true,
        created_at: new Date(),
      });
      await addLog(db, session.username, 'ÚJ ESEMÉNY', `Létrehozta: ${doc.name}`);
      return NextResponse.json({ success: true, id: result.insertedId });
    }

    if (actionType === 'EDIT_TOURNAMENT') {
      const { id, ...rest } = payload;
      const existingEvent = await db.collection('tournaments').findOne(getQuery(id));
      if (!existingEvent) return NextResponse.json({ error: 'Esemény nem található.' }, { status: 404 });
      const updates = applyOpenAttendance(pickTournamentFields(rest));
      // A jelenlegi és (ha változik) az új játékhoz is jogosultság kell, így a szervező nem "viheti át" az eseményt más játékba
      if (!canManageEvent(session, existingEvent) || (updates.category !== undefined && !canManageCategory(session, updates.category))) {
        return noPermission();
      }
      await db.collection('tournaments').updateOne(getQuery(id), { $set: updates });
      await addLog(db, session.username, 'MÓDOSÍTÁS', `Szerkesztette: ${updates.name ?? payload.name ?? 'esemény'}`);
      // Ha nőtt a max. létszám, a várólistáról előlépnek a következők
      const promoted = await promoteFromQueue(db, id);
      if (promoted.length > 0) await addLog(db, 'Rendszer', 'VÁRÓLISTA', `Előléptetve (létszámváltozás): ${promoted.join(', ')}`);
      return NextResponse.json({ success: true });
    }

    if (actionType === 'DELETE_TOURNAMENT') {
      const event = await db.collection('tournaments').findOne(getQuery(payload.tournamentId || payload.id));
      if (event && !canManageEvent(session, event)) return noPermission();
      await db.collection('tournaments').deleteMany(getQuery(payload.tournamentId || payload.id));
      await db.collection('registrations').deleteMany({ tournamentId: String(payload.tournamentId || payload.id) });
      if (event) await addLog(db, session.username, 'TÖRLÉS', `Törölte az eseményt: ${event.name}`);
      return NextResponse.json({ success: true });
    }

    if (actionType === 'TOGGLE_GATE') {
      const event = await db.collection('tournaments').findOne(getQuery(payload.tournamentId));
      if (!event) return NextResponse.json({ error: 'Esemény nem található.' }, { status: 404 });
      if (!canManageEvent(session, event)) return noPermission();
      await db.collection('tournaments').updateOne(getQuery(payload.tournamentId), { $set: { is_open: payload.newState === true } });
      await addLog(db, session.username, 'KAPU NYITÁS/ZÁRÁS', `${payload.newState ? 'Megnyitotta' : 'Lezárta'}: ${event?.name}`);
      return NextResponse.json({ success: true });
    }

    if (actionType === 'CLEANUP_OLD_EVENTS') {
      const ownerSession = await verifyOwner();
      if (!ownerSession) {
        return NextResponse.json({ error: 'Csak Admin2 futtathatja a takarítást!' }, { status: 403 });
      }

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
      const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
      const displayName = typeof name === 'string' ? name.trim() : '';

      if (!displayName || displayName.length > 120) {
        return NextResponse.json({ error: 'Érvényes nevet adj meg.' }, { status: 400 });
      }
      if (!isValidEmail(normalizedEmail)) {
        return NextResponse.json({ error: 'Érvényes e-mail címet adj meg.' }, { status: 400 });
      }

      // Kitalált e-mail címekkel való tömeges jelentkezés ellen IP-címenként is korlátozunk.
      // Bőkezű határ: egy bolt wifijéről egy versenyestén sokan jelentkezhetnek ugyanarról az IP-ről.
      const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
      const allowed = await consumeRateLimit(db, `join-ip:${ip}`, 60, 60 * 60 * 1000)
        && await consumeRateLimit(db, `join:${normalizedEmail}`, 15, 60 * 60 * 1000);
      if (!allowed) {
        return NextResponse.json({ error: 'Túl sok jelentkezési kísérlet. Próbáld újra később.' }, { status: 429 });
      }

      const isBanned = await db.collection('blacklist').findOne({ email: normalizedEmail });
      if (isBanned) {
        return NextResponse.json({ error: "Sajnáljuk, de erről az e-mail címről a jelentkezés letiltásra került a Tavern rendszerében." }, { status: 403 });
      }

      const tQuery = getQuery(tournamentId);
      const targetEvent = await db.collection('tournaments').findOne(tQuery);
      if (!targetEvent) return NextResponse.json({ error: "Esemény nem található" }, { status: 404 });
      if (targetEvent.isOpenAttendance) {
        return NextResponse.json({ error: "Ehhez az eseményhez nincs jelentkezés (kötetlen létszám)." }, { status: 400 });
      }
      const existing = await db.collection('registrations').findOne({ tournamentId: String(tournamentId), email: normalizedEmail });
      if (existing) return NextResponse.json({ error: "Már jelentkeztél erre az eseményre.", code: 'ALREADY_REGISTERED' }, { status: 400 });

      const activeFilter = {
        $and: [tQuery, { is_open: true }, { $expr: { $lt: ['$current_players', '$max_players'] } }],
      };
      let isQueue = false;
      let tournament = await db.collection('tournaments').findOneAndUpdate(
        activeFilter,
        { $inc: { current_players: 1 } },
        { returnDocument: 'after' }
      );

      if (!tournament) {
        tournament = await db.collection('tournaments').findOneAndUpdate(
          { $and: [tQuery, { is_open: true }] },
          { $inc: { queue_count: 1 } },
          { returnDocument: 'after' }
        );
        if (!tournament) {
          const closed = await db.collection('tournaments').findOne(tQuery);
          if (!closed) return NextResponse.json({ error: "Esemény nem található" }, { status: 404 });
          return NextResponse.json({ error: "A jelentkezés lezárult" }, { status: 400 });
        }
        isQueue = true;
      }

      const counterField = isQueue ? 'queue_count' : 'current_players';
      const cancelToken = newCancelToken();
      try {
        await db.collection('registrations').insertOne({
          tournamentId: String(tournamentId),
          tournamentName: tournament.name,
          name: displayName,
          email: normalizedEmail,
          status: isQueue ? 'Várólista' : 'Aktív',
          date: new Date(),
          cancelToken,
        });
      } catch (insertErr) {
        await db.collection('tournaments').updateOne(tQuery, { $inc: { [counterField]: -1 } });
        if (insertErr?.code === 11000) {
          return NextResponse.json({ error: "Már jelentkeztél erre az eseményre.", code: 'ALREADY_REGISTERED' }, { status: 400 });
        }
        throw insertErr;
      }

      // A visszaigazoló levél hibája ne rontsa el a már sikeres jelentkezést
      let mailSent = false;
      if (isMailConfigured()) {
        try {
          await sendJoinMail(request, { email: normalizedEmail, name: displayName, tournament, isQueue, token: cancelToken });
          mailSent = true;
        } catch (mailErr) {
          console.error('join mail error:', mailErr);
        }
      }

      return NextResponse.json({ success: true, isQueue, mailSent });
    }

    if (actionType === 'UNSUBSCRIBE_BY_EMAIL') {
      const { tournamentId, email } = payload;
      const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
      if (!isValidEmail(normalizedEmail)) {
        return NextResponse.json({ error: 'Érvényes e-mail címet adj meg.' }, { status: 400 });
      }

      // E-mail küldésnél szigorúbb korlát, hogy ne lehessen valakinek a postafiókját telespammelni
      const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
      const allowed = await consumeRateLimit(db, `unsub-ip:${ip}`, 30, 60 * 60 * 1000)
        && await consumeRateLimit(db, `unsub:${normalizedEmail}`, 5, 60 * 60 * 1000);
      if (!allowed) {
        return NextResponse.json({ error: 'Túl sok kísérlet. Próbáld újra később.' }, { status: 429 });
      }

      const reg = await db.collection('registrations').findOne({ tournamentId: String(tournamentId), email: normalizedEmail });

      if (isMailConfigured()) {
        // Megerősítő levél: csak az tud leiratkozni, aki hozzáfér a postafiókhoz.
        // A válasz mindig ugyanaz, így nem derül ki, hogy az adott cím jelentkezett-e.
        if (reg) {
          let token = reg.cancelToken;
          if (!token) {
            token = newCancelToken();
            await db.collection('registrations').updateOne({ _id: reg._id }, { $set: { cancelToken: token } });
          }
          try {
            await sendUnsubscribeMail(request, { email: normalizedEmail, reg, token });
          } catch (mailErr) {
            console.error('unsubscribe mail error:', mailErr);
            return NextResponse.json({ error: 'A megerősítő e-mailt most nem sikerült elküldeni. Próbáld újra később.' }, { status: 502 });
          }
        }
        return NextResponse.json({ success: true, emailSent: true });
      }

      // E-mail szolgáltatás nélkül (még nincs beállítva): azonnali leiratkozás, megerősítés nélkül
      if (!reg) return NextResponse.json({ error: "Nincs jelentkezés erről az e-mail címről." }, { status: 404 });
      await removeRegistration(db, reg);
      return NextResponse.json({ success: true });
    }

    // Leiratkozás az e-mailben kapott linkkel (a /leiratkozas oldal megerősítő gombja hívja)
    if (actionType === 'UNSUBSCRIBE_BY_TOKEN') {
      const token = typeof payload.token === 'string' ? payload.token : '';
      if (token.length < 20 || token.length > 100) return NextResponse.json({ error: 'Érvénytelen link.' }, { status: 400 });
      const reg = await db.collection('registrations').findOne({ cancelToken: token });
      if (!reg) return NextResponse.json({ error: 'Ez a link már nem érvényes (lehet, hogy már leiratkoztál).' }, { status: 404 });
      await removeRegistration(db, reg);
      return NextResponse.json({ success: true, tournamentName: reg.tournamentName });
    }

    // --- JELENTKEZÉSEK KEZELÉSE (ADMIN) ---
    if (actionType === 'REMOVE_REGISTRATION') {
      const reg = await db.collection('registrations').findOne(getQuery(payload.registrationId));
      if (!reg) return NextResponse.json({ error: "Nem található" }, { status: 404 });
      const event = await db.collection('tournaments').findOne(getQuery(reg.tournamentId));
      if (event && !canManageEvent(session, event)) return noPermission();
      await removeRegistration(db, reg);
      await addLog(db, session.username, 'JELENTKEZŐ TÖRLÉSE', `Törölte ${reg.name} jelentkezését (${reg.tournamentName})`);
      return NextResponse.json({ success: true });
    }

    // --- SZERVEZŐK JÁTÉK-JOGOSULTSÁGA (OWNER ONLY) ---
    if (actionType === 'SET_ADMIN_CATEGORIES') {
      const ownerSession = await verifyOwner();
      if (!ownerSession) return NextResponse.json({ error: 'Csak a tulajdonos állíthat jogosultságot!' }, { status: 403 });
      const target = await db.collection('users').findOne(getQuery(payload.userId));
      if (!target) return NextResponse.json({ error: 'Felhasználó nem található.' }, { status: 404 });
      if (target.role === 'owner') return NextResponse.json({ error: 'Tulajdonosi fiók nem korlátozható.' }, { status: 403 });

      const categories = sanitizeCategories(payload.categories); // null = minden játék
      await db.collection('users').updateOne({ _id: target._id }, categories === null ? { $unset: { allowedCategories: '' } } : { $set: { allowedCategories: categories } });
      await addLog(db, session.username, 'JOGOSULTSÁG', `${target.username} kezelhető játékai: ${categories === null ? 'minden játék' : (categories.join(', ') || 'egyik sem')}`);
      return NextResponse.json({ success: true });
    }

    // --- ÚJ FELHASZNÁLÓ LÉTREHOZÁSA ideiglenes, egyszer használatos jelszóval (OWNER ONLY) ---
    if (actionType === 'CREATE_USER') {
      const ownerSession = await verifyOwner();
      if (!ownerSession) return NextResponse.json({ error: 'Csak Tulajdonos hozhat létre felhasználót!' }, { status: 403 });

      const newUsername = typeof payload?.username === 'string' ? payload.username.trim() : '';
      const newEmail = typeof payload?.email === 'string' ? payload.email.trim().toLowerCase() : '';
      const newRole = payload?.role === 'customer' ? 'customer' : 'admin';

      if (!/^[\p{L}\p{N}._-]{3,32}$/u.test(newUsername)) {
        return NextResponse.json({ error: 'A felhasználónév 3-32 karakter lehet, és csak betűt, számot, pontot, aláhúzást vagy kötőjelet tartalmazhat.' }, { status: 400 });
      }
      if (!isValidEmail(newEmail)) {
        return NextResponse.json({ error: 'Érvényes e-mail címet adj meg.' }, { status: 400 });
      }

      const usersColl = db.collection('users');
      const dupEmail = await usersColl.findOne({ email: newEmail });
      const dupName = await usersColl.findOne({ username: newUsername }, { collation: { locale: 'en', strength: 2 } });
      if (dupEmail || dupName) {
        return NextResponse.json({ error: 'Ez az e-mail vagy felhasználónév már foglalt!' }, { status: 400 });
      }

      const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
      let tempPassword = '';
      for (let i = 0; i < 12; i++) tempPassword += ALPHABET[randomInt(ALPHABET.length)];

      const expiresAt = new Date(Date.now() + TEMP_PASSWORD_TTL_MS);
      await usersColl.insertOne({
        username: newUsername,
        email: newEmail,
        password: await bcrypt.hash(tempPassword, 10),
        role: newRole,
        mustChangePassword: true,
        tempPasswordExpires: expiresAt,
        createdAt: new Date(),
        createdBy: ownerSession.username,
      });
      await addLog(db, session.username, 'ÚJ FELHASZNÁLÓ', `Létrehozta: ${newUsername} (${newRole === 'admin' ? 'Admin' : 'Játékos'}), ideiglenes jelszóval.`);
      return NextResponse.json({ success: true, username: newUsername, email: newEmail, tempPassword, expiresAt });
    }

    // --- FELHASZNÁLÓK (OWNER ONLY) ---
    if (actionType === 'TOGGLE_ROLE' || actionType === 'DELETE_USER') {
      const ownerSession = await verifyOwner();
      if (!ownerSession) return NextResponse.json({ error: 'Csak Tulajdonos módosíthatja a fiókokat!' }, { status: 403 });

      // Tulajdonosi fiókot (a sajátot sem) nem lehet innen visszafokozni vagy törölni, különben elveszhet az egyetlen tulajdonos
      const target = await db.collection('users').findOne(getQuery(actionType === 'TOGGLE_ROLE' ? payload.targetUserId : payload.userId));
      if (!target) return NextResponse.json({ error: 'Felhasználó nem található.' }, { status: 404 });
      if (target.role === 'owner') return NextResponse.json({ error: 'Tulajdonosi fiók nem módosítható.' }, { status: 403 });

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
      if (!payload.newPassword || payload.newPassword.length < 6) {
        return NextResponse.json({ error: 'Az új jelszónak legalább 6 karakter hosszúnak kell lennie.' }, { status: 400 });
      }

      const target = await db.collection('users').findOne(getQuery(payload.userId));
      if (!target) return NextResponse.json({ error: 'Felhasználó nem található.' }, { status: 404 });
      if (target.role === 'owner') return NextResponse.json({ error: 'Tulajdonosi fiók jelszava itt nem módosítható.' }, { status: 403 });

      const hashedPassword = await bcrypt.hash(payload.newPassword, 10);
      await db.collection('users').updateOne(getQuery(payload.userId), { $set: { password: hashedPassword }, $unset: { mustChangePassword: '', tempPasswordExpires: '' } });
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

    if (actionType === 'BAN_EMAIL' || actionType === 'UNBAN_EMAIL') {
      const ownerSession = await verifyOwner();
      if (!ownerSession) {
        return NextResponse.json({ error: 'Csak Admin2 kezelheti a feketelistát!' }, { status: 403 });
      }
      const banEmail = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
      if (!isValidEmail(banEmail)) {
        return NextResponse.json({ error: 'Érvényes e-mail címet adj meg.' }, { status: 400 });
      }

      if (actionType === 'BAN_EMAIL') {
        await db.collection('blacklist').updateOne(
          { email: banEmail },
          { $set: { reason: payload.reason || '', date: new Date() } },
          { upsert: true }
        );
        await addLog(db, session.username, 'FEKETELISTA', `Letiltotta: ${banEmail}`);
      } else {
        await db.collection('blacklist').deleteOne({ email: banEmail });
        await addLog(db, session.username, 'FEKETELISTA', `Feloldotta: ${banEmail}`);
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Ismeretlen művelet.' }, { status: 400 });
  } catch (error) {
    console.error('actions error:', error);
    return NextResponse.json({ error: 'Szerverhiba történt.' }, { status: 500 });
  }
}