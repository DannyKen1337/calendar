// Mentés a Google Drive-ra (a heti takarítás a törlés előtt ide menti, amit töröl; a Rendszer oldalon kézzel is indítható).
// A tulajdonos Google-fiókjával, egyszer megadott engedéllyel (OAuth, „drive.file” jog: a program csak a saját maga
// által létrehozott fájlokat és mappát látja, a Drive többi részéhez nem fér hozzá). Beállítás: docs/google-drive.md.
//   GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET – a Google Cloud OAuth-ügyfél (asztali alkalmazás típus)
//   GOOGLE_DRIVE_REFRESH_TOKEN – a beállító szkript adja (scripts/google-drive-setup.mjs)
// A mappát („Tavern naptár – mentések”) a program maga hozza létre az első mentéskor, az azonosítója a settings
// gyűjteményben van (drive_backup); ha valaki törli, a következő mentés újat hoz létre.
export const DRIVE_FOLDER_NAME = 'Tavern naptár – mentések';
const STATE = 'drive_backup';

const prod = () => process.env.NODE_ENV === 'production';
// A tesztekhez a Google címei helyi hamis szerverre cserélhetők (élesben nem)
const apiBase = () => (!prod() && process.env.GOOGLE_DRIVE_TEST_BASE) || 'https://www.googleapis.com';
const tokenUrl = () => (!prod() && process.env.GOOGLE_DRIVE_TEST_BASE ? `${process.env.GOOGLE_DRIVE_TEST_BASE}/token` : 'https://oauth2.googleapis.com/token');

export const driveConfigured = (env = process.env) => !!(env.GOOGLE_DRIVE_CLIENT_ID && env.GOOGLE_DRIVE_CLIENT_SECRET && env.GOOGLE_DRIVE_REFRESH_TOKEN);

class DriveError extends Error {}

async function accessToken(fetchFn) {
  const res = await fetchFn(tokenUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_DRIVE_CLIENT_ID,
      client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    if (json.error === 'invalid_grant') throw new DriveError('A Google-engedély lejárt vagy visszavonták. Futtasd újra a beállító szkriptet, és cseréld le a GOOGLE_DRIVE_REFRESH_TOKEN értékét.');
    throw new DriveError(`A Google-belépés nem sikerült (${json.error || res.status}).`);
  }
  return json.access_token;
}

async function createFolder(fetchFn, token) {
  const res = await fetchFn(`${apiBase()}/drive/v3/files?fields=id`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.id) throw new DriveError(`A mentési mappa nem jött létre (${res.status}).`);
  return json.id;
}

async function upload(fetchFn, token, folderId, name, content) {
  const boundary = `tavern${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  const meta = JSON.stringify({ name, parents: [folderId], mimeType: 'application/json' });
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${content}\r\n--${boundary}--`;
  return fetchFn(`${apiBase()}/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,size`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
}

// Egy JSON-fájl feltöltése a mentési mappába. Visszaad: { id, name, link, bytes }. Hibánál kivételt dob (érthető szöveggel).
export async function saveToDrive(db, name, data, { fetchFn = fetch } = {}) {
  if (!driveConfigured()) throw new DriveError('A Google Drive-mentés nincs beállítva.');
  const settings = db.collection('settings');
  const content = JSON.stringify(data, null, 1);
  try {
    const token = await accessToken(fetchFn);
    // a mappa azonosítója rögtön a létrehozás után elmentődik (egy sikertelen feltöltés után se jöjjön létre új mappa)
    const newFolder = async () => {
      const id = await createFolder(fetchFn, token);
      await settings.updateOne({ _id: STATE }, { $set: { folderId: id } }, { upsert: true });
      return id;
    };
    let folderId = (await settings.findOne({ _id: STATE }))?.folderId || await newFolder();
    let res = await upload(fetchFn, token, folderId, name, content);
    // a mappát törölték (vagy nem érhető el): új mappa, és még egy próba
    if (res.status === 404) {
      folderId = await newFolder();
      res = await upload(fetchFn, token, folderId, name, content);
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.id) throw new DriveError(`A feltöltés nem sikerült (${json.error?.message || res.status}).`);
    const saved = { id: json.id, name: json.name || name, link: json.webViewLink || null, bytes: Buffer.byteLength(content) };
    await settings.updateOne({ _id: STATE }, { $set: { folderId, last: { ...saved, at: new Date() }, error: null } }, { upsert: true });
    return saved;
  } catch (err) {
    const message = err instanceof DriveError ? err.message : `A Google Drive nem érhető el (${String(err?.message || err).slice(0, 120)}).`;
    await settings.updateOne({ _id: STATE }, { $set: { error: { at: new Date(), message } } }, { upsert: true });
    throw new DriveError(message);
  }
}

// A Rendszer oldalnak: { configured, last: { at, name, link, bytes } | null, error: { at, message } | null }
export async function driveStatus(db) {
  const st = await db.collection('settings').findOne({ _id: STATE });
  return { configured: driveConfigured(), last: st?.last || null, error: st?.error || null };
}
