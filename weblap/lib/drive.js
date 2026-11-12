// Képek behúzása egy megosztott Google Drive-mappából (a Galéria albumaihoz), a Google hivatalos Drive API-jával.
// Beállítás: GOOGLE_API_KEY (ingyenes Google Cloud API-kulcs, a Google Drive API bekapcsolva). A mappát a Drive-ban
// meg kell osztani: „Bárki, aki rendelkezik a linkkel” (megtekintő). Belépés és OAuth nem kell.
// A képeket nem a Drive-ról mutatjuk (az nem megbízható és lassú), hanem átmásoljuk az ImgBB-re, mint a feltöltötteket.
import 'server-only';
import { driveTime } from '@/weblap/lib/albums';

const API = 'https://www.googleapis.com/drive/v3/files';
const FOLDER = 'application/vnd.google-apps.folder';
const MAX_FILES = 1500;   // egy behúzásban legfeljebb ennyi kép
const MAX_DEPTH = 4;      // ennyi almappa-szintig megy le
export const DRIVE_MAX_BYTES = 25 * 1024 * 1024;

export const driveConfigured = () => !!process.env.GOOGLE_API_KEY;

async function api(path, params = {}) {
  const qs = new URLSearchParams({ ...params, key: process.env.GOOGLE_API_KEY, supportsAllDrives: 'true' });
  const res = await fetch(`${API}${path}?${qs}`, { cache: 'no-store' });
  if (res.status === 403 || res.status === 404) throw new DriveError('A mappa nem érhető el. A Google Drive-ban állítsd be: Megosztás › Általános hozzáférés › „Bárki, aki rendelkezik a linkkel”.');
  if (!res.ok) throw new DriveError(`A Google Drive most nem válaszol (${res.status}). Próbáld újra később.`);
  return res;
}

export class DriveError extends Error {}

// A mappa és almappái képei: [{ id, name, type, path, lastModified, size }]; a path a mappán belüli út a mappa nevével
// kezdve ("Események/Pokeween 2026-10-31/IMG_1.jpg"), ugyanúgy, mint a gépről feltöltött mappánál.
export async function listDriveFolder(folderId) {
  if (!driveConfigured()) throw new DriveError('A Google Drive-ból való behúzás még nincs beállítva (GOOGLE_API_KEY).');
  const root = await (await api(`/${encodeURIComponent(folderId)}`, { fields: 'id,name,mimeType' })).json();
  if (root.mimeType !== FOLDER) throw new DriveError('Ez a link nem egy mappára mutat. Egy Drive-mappa linkjét másold be.');
  const files = [];
  const queue = [{ id: root.id, path: root.name, depth: 0 }];
  while (queue.length && files.length < MAX_FILES) {
    const dir = queue.shift();
    let pageToken;
    do {
      const data = await (await api('', {
        q: `'${dir.id}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, imageMediaMetadata(time))',
        pageSize: '1000', includeItemsFromAllDrives: 'true', orderBy: 'name',
        ...(pageToken ? { pageToken } : {}),
      })).json();
      for (const f of data.files || []) {
        if (f.mimeType === FOLDER) { if (dir.depth < MAX_DEPTH) queue.push({ id: f.id, path: `${dir.path}/${f.name}`, depth: dir.depth + 1 }); }
        else if (f.mimeType?.startsWith('image/') && files.length < MAX_FILES) {
          files.push({ id: f.id, name: f.name, type: f.mimeType, path: `${dir.path}/${f.name}`, lastModified: driveTime(f), size: +f.size || 0 });
        }
      }
      pageToken = data.nextPageToken;
    } while (pageToken && files.length < MAX_FILES);
  }
  return files;
}

// Egy kép letöltése a Drive-ról: { data: Buffer, type, name }
export async function downloadDriveImage(fileId) {
  if (!driveConfigured()) throw new DriveError('A Google Drive-ból való behúzás nincs beállítva (GOOGLE_API_KEY).');
  const meta = await (await api(`/${encodeURIComponent(fileId)}`, { fields: 'id,name,mimeType,size' })).json();
  if (!meta.mimeType?.startsWith('image/')) throw new DriveError('Ez nem kép.');
  if (+meta.size > DRIVE_MAX_BYTES) throw new DriveError('A kép túl nagy (legfeljebb 25 MB).');
  const res = await api(`/${encodeURIComponent(fileId)}`, { alt: 'media' });
  return { data: Buffer.from(await res.arrayBuffer()), type: meta.mimeType, name: meta.name };
}
