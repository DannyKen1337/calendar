'use server';
// A szerkesztőfelület műveletei. Mindegyik maga ellenőrzi a jogot (a felület elrejtése nem védelem).
// A módosítások a naptár naplójába (audit_logs) is bekerülnek, "WEBLAP" művelettel.
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { getTavernDb } from '@/weblap/lib/db';
import { getEditor, logout } from '@/weblap/lib/auth';
import { withBase } from '@/weblap/lib/basePath';
import { saveTab, resetTab } from '@/weblap/lib/content';
import { tabByKey } from '@/weblap/lib/contentSchema';

// A weboldal minden oldala (a route group is a cache-címke része)
const refreshSite = () => revalidatePath('/(weblap)/weblapteszt', 'layout');

async function addLog(db, editor, details) {
  await db.collection('audit_logs').insertOne({ adminName: editor.username, action: 'WEBLAP', details, date: new Date() }).catch(() => {});
}

async function requireEditor() {
  const editor = await getEditor();
  if (!editor) throw new Error('Nincs bejelentkezve, vagy nincs Weblap mester joga.');
  return editor;
}

const objectId = (id) => (typeof id === 'string' && id.length === 24 && ObjectId.isValid(id) ? new ObjectId(id) : null);

// --- Kilépés (a belépés a naptárban van, ugyanaz a süti) ---

export async function logoutAction() {
  await logout();
  redirect(withBase('/admin'));
}

// --- Idő: a űrlap magyar helyi időt küld ("2026-10-29T18:00") ---

function budapestParts(ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  return p;
}
const offsetAt = (ms) => { const p = budapestParts(ms); return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(ms / 60000) * 60000; };

function budapestToDate(local) {
  const m = String(local || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let ts = guess - offsetAt(guess);
  ts = guess - offsetAt(ts); // nyári / téli időszámítás váltásánál
  return new Date(ts);
}

// --- Kép feltöltése (ImgBB, mint a naptárban; IMGBB_API_KEY) ---

const MAX_IMAGE = 4 * 1024 * 1024;

async function uploadImage(file) {
  const key = process.env.IMGBB_API_KEY;
  if (!key) return { error: 'A képfeltöltés nincs beállítva (IMGBB_API_KEY). Adj meg inkább egy kép-URL-t.' };
  if (!file.type?.startsWith('image/')) return { error: 'Csak képet lehet feltölteni.' };
  if (file.size > MAX_IMAGE) return { error: 'A kép legfeljebb 4 MB lehet.' };
  const body = new FormData();
  body.append('image', file);
  try {
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(key)}`, { method: 'POST', body });
    const data = await res.json();
    if (data?.success && data.data?.url) return { url: data.data.url };
  } catch (err) {
    console.error('képfeltöltés:', err);
  }
  return { error: 'Nem sikerült feltölteni a képet. Próbáld újra, vagy adj meg kép-URL-t.' };
}

const isHttpUrl = (v) => { try { return ['http:', 'https:'].includes(new URL(v).protocol); } catch { return false; } };

// --- Hírek ---

export async function savePostAction(_prev, formData) {
  const editor = await requireEditor();
  const id = String(formData.get('id') || '');
  const title = String(formData.get('title') || '').trim().replace(/\s+/g, ' ');
  const text = String(formData.get('text') || '').replace(/\r\n/g, '\n').trim();
  const link = String(formData.get('link') || '').trim();
  const imageUrl = String(formData.get('imageUrl') || '').trim();
  const imageFile = formData.get('imageFile');
  const removeImage = formData.get('removeImage') === 'on';
  const published = formData.get('published') === 'on';
  const pinned = formData.get('pinned') === 'on';
  const date = formData.get('date') ? budapestToDate(formData.get('date')) : new Date();
  const values = { title, text, link, imageUrl, date: String(formData.get('date') || ''), published, pinned };

  if (!title) return { error: 'A cím kötelező.', values };
  if (title.length > 140) return { error: 'A cím legfeljebb 140 karakter lehet.', values };
  if (text.length > 10000) return { error: 'A szöveg legfeljebb 10 000 karakter lehet.', values };
  if (link && !isHttpUrl(link)) return { error: 'A link http:// vagy https:// kezdetű cím legyen.', values };
  if (imageUrl && !isHttpUrl(imageUrl)) return { error: 'A kép URL-je http:// vagy https:// kezdetű legyen.', values };
  if (!date) return { error: 'Hibás dátum.', values };

  let image = removeImage ? null : imageUrl || null;
  if (imageFile && typeof imageFile === 'object' && imageFile.size > 0) {
    const up = await uploadImage(imageFile);
    if (up.error) return { error: up.error, values };
    image = up.url;
  }

  const db = await getTavernDb();
  const posts = db.collection('website_posts');
  const doc = { title, text, link: link || null, image, date, published, pinned, updatedBy: editor.username, updatedAt: new Date() };
  if (id) {
    const _id = objectId(id);
    if (!_id) return { error: 'Ismeretlen hír.', values };
    const res = await posts.updateOne({ _id }, { $set: doc });
    if (!res.matchedCount) return { error: 'Ezt a hírt közben törölték.', values };
    await addLog(db, editor, `Hír módosítva: ${title}`);
  } else {
    await posts.insertOne({ ...doc, createdBy: editor.username, createdAt: new Date() });
    await addLog(db, editor, `Új hír${published ? '' : ' (piszkozat)'}: ${title}`);
  }
  refreshSite();
  redirect(withBase('/admin?mentve=1'));
}

export async function deletePostAction(formData) {
  const editor = await requireEditor();
  const _id = objectId(String(formData.get('id') || ''));
  if (!_id) return;
  const db = await getTavernDb();
  const post = await db.collection('website_posts').findOneAndDelete({ _id });
  if (post) await addLog(db, editor, `Hír törölve: ${post.title}`);
  refreshSite();
  redirect(withBase('/admin'));
}

// Kiemelés / elrejtés. key: "manual:<id>" (csak kiemelés, és közzététel ki-be) vagy "facebook:<id>" / "instagram:<id>"
export async function toggleAction(formData) {
  const editor = await requireEditor();
  const key = String(formData.get('key') || '');
  const field = String(formData.get('field') || '');
  const value = formData.get('value') === '1';
  const [source, ...rest] = key.split(':');
  const id = rest.join(':');
  const db = await getTavernDb();
  if (source === 'manual' && (field === 'pinned' || field === 'published')) {
    const _id = objectId(id);
    if (!_id) return;
    const post = await db.collection('website_posts').findOneAndUpdate({ _id }, { $set: { [field]: value, updatedBy: editor.username, updatedAt: new Date() } });
    if (post) await addLog(db, editor, `Hír ${field === 'pinned' ? (value ? 'kiemelve' : 'kiemelés levéve') : (value ? 'közzétéve' : 'visszavonva')}: ${post.title}`);
  } else if ((source === 'facebook' || source === 'instagram') && id && /^[\w-]+$/.test(id) && (field === 'pinned' || field === 'hidden')) {
    await db.collection('website_post_flags').updateOne({ _id: key }, { $set: { [field]: value, updatedBy: editor.username, updatedAt: new Date() } }, { upsert: true });
    const label = source === 'facebook' ? 'Facebook' : 'Instagram';
    await addLog(db, editor, `${label}-poszt ${field === 'pinned' ? (value ? 'kiemelve' : 'kiemelés levéve') : (value ? 'elrejtve' : 'újra látható')} (${id})`);
  } else {
    return;
  }
  refreshSite();
  redirect(withBase('/admin'));
}

// --- Az oldal tartalma (fülenként: Általános, Nyitókép, Kínálat, Program, Boltok, Hírek rész, Lábléc) ---

// Egy fül mentése. A payload a fül teljes tartalma JSON-ban; a szerver a séma szerint ellenőrzi.
// Visszaad: { ok, data, at } (az elmentett, ellenőrzött tartalom) vagy { error }
export async function saveContentAction(_prev, formData) {
  const editor = await requireEditor();
  const key = String(formData.get('tab') || '');
  const tab = tabByKey(key);
  if (!tab) return { error: 'Ismeretlen fül.' };
  let value;
  try {
    value = JSON.parse(String(formData.get('payload') || ''));
  } catch {
    return { error: 'Hibás adat érkezett. Töltsd újra az oldalt.' };
  }
  const res = await saveTab(key, value, editor.username);
  if (res.errors) return { error: res.errors.join('\n') };
  const db = await getTavernDb();
  await addLog(db, editor, `Oldal tartalma módosítva: ${tab.label}`);
  refreshSite();
  return { ok: true, data: res.data, at: Date.now() };
}

// Egy fül visszaállítása az eredeti tartalomra
export async function resetContentAction(formData) {
  const editor = await requireEditor();
  const key = String(formData.get('tab') || '');
  const tab = tabByKey(key);
  if (!tab) return;
  await resetTab(key, editor.username);
  const db = await getTavernDb();
  await addLog(db, editor, `Oldal tartalma visszaállítva az eredetire: ${tab.label}`);
  refreshSite();
  redirect(withBase(`/admin?lap=${key}&visszaallitva=1`));
}

// Kép feltöltése egy tartalommezőhöz (ImgBB). Visszaad: { url } vagy { error }
export async function uploadImageAction(formData) {
  await requireEditor();
  const file = formData.get('file');
  if (!file || typeof file !== 'object' || !file.size) return { error: 'Nincs kiválasztva kép.' };
  return uploadImage(file);
}
