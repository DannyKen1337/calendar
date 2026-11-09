// A hírek: a kézzel kirakott bejegyzések (website_posts) és a Facebookról / Instagramról behúzott posztok egy listában.
// A behúzott posztokat a szerkesztő elrejtheti vagy kiemelheti (website_post_flags, kulcs: "facebook:<id>").
// A kiemelt hírek elöl állnak, a többi a dátum szerint, legújabb elöl.
//
// Előnézet és éles oldal: a szerkesztőfelület a munkapéldányt írja (website_posts, website_post_flags); az éles oldal
// a kirakott másolatot olvassa (website_posts_live, website_post_flags_live). Kirakáskor a munkapéldány átmásolódik.
//
// website_posts: { title, text, image, link, date, published, pinned, createdBy, createdAt, updatedBy, updatedAt }
import 'server-only';
import { ObjectId } from 'mongodb';
import { getTavernDb, hasDatabase } from '@/weblap/lib/db';
import { getFacebookPosts, getInstagramPosts } from '@/weblap/lib/social';

export const SOURCE_NAMES = { manual: 'Tavern', facebook: 'Facebook', instagram: 'Instagram' };

const manualPost = (p) => ({
  key: `manual:${p._id}`,
  source: 'manual',
  id: String(p._id),
  title: p.title || '',
  text: p.text || '',
  image: p.image || null,
  url: p.link || null,
  date: new Date(p.date).toISOString(),
  published: !!p.published,
  pinned: !!p.pinned,
  hidden: false,
});

export const WORK = { posts: 'website_posts', flags: 'website_post_flags' };
export const LIVE = { posts: 'website_posts_live', flags: 'website_post_flags_live' };

// Egyszeri átállás: a bevezetéskor az addigi (éles) hírek és jelölések lesznek a kirakott másolat
let stagingReady = false;
export async function ensureStaging(db) {
  if (stagingReady) return;
  const meta = db.collection('website_content');
  if (!(await meta.findOne({ _id: 'staging' }))) {
    for (const k of ['posts', 'flags']) {
      if (await db.collection(LIVE[k]).estimatedDocumentCount() === 0) {
        const docs = await db.collection(WORK[k]).find({}).toArray();
        if (docs.length) await db.collection(LIVE[k]).insertMany(docs);
      }
    }
    await meta.updateOne({ _id: 'staging' }, { $setOnInsert: { at: new Date() } }, { upsert: true });
  }
  stagingReady = true;
}

// includeDrafts: a nem megjelenő hírek is (szerkesztőfelület); preview: a munkapéldány (előnézet, szerkesztőfelület)
async function loadAll({ includeDrafts, preview }) {
  const db = hasDatabase() ? await getTavernDb().catch((err) => { console.error('hírek: adatbázis hiba', err); return null; }) : null;
  if (db) await ensureStaging(db);
  const names = preview ? WORK : LIVE;
  const [manual, flags, facebook, instagram] = await Promise.all([
    db ? db.collection(names.posts).find(includeDrafts ? {} : { published: true }).sort({ date: -1 }).limit(60).toArray() : [],
    db ? db.collection(names.flags).find({}).toArray() : [],
    getFacebookPosts(),
    getInstagramPosts(),
  ]);
  const flagByKey = new Map(flags.map(f => [f._id, f]));
  const social = [...facebook, ...instagram].map(p => {
    const key = `${p.source}:${p.id}`;
    const f = flagByKey.get(key);
    return { ...p, key, title: '', published: true, pinned: !!f?.pinned, hidden: !!f?.hidden };
  });
  return [...manual.map(manualPost), ...social]
    .sort((a, b) => (b.pinned - a.pinned) || b.date.localeCompare(a.date));
}

// A nyilvános hírfolyam (elrejtett és piszkozat nélkül). preview: az előnézeté. Hiba esetén üres lista.
export async function getFeed(limit = 6, { preview = false } = {}) {
  try {
    return (await loadAll({ includeDrafts: false, preview })).filter(p => !p.hidden).slice(0, limit);
  } catch (err) {
    console.error('hírek betöltése:', err);
    return [];
  }
}

// A szerkesztőfelület listája: minden, a piszkozatok és az elrejtett posztok is
export const getAllForEditor = () => loadAll({ includeDrafts: true, preview: true });

// Egy kirakott hír a saját oldalához (csak megjelenő). preview: az előnézet munkapéldányából
export async function getManualPost(id, { preview = false } = {}) {
  if (!hasDatabase() || !ObjectId.isValid(id) || String(id).length !== 24) return null;
  const db = await getTavernDb();
  await ensureStaging(db);
  const p = await db.collection((preview ? WORK : LIVE).posts).findOne({ _id: new ObjectId(id), published: true });
  return p ? manualPost(p) : null;
}

// A hírek eltérései a kirakott állapottól: { added: [cím], changed: [cím], removed: [cím], flags: szám }
const POST_FIELDS = ['title', 'text', 'image', 'link', 'published', 'pinned'];
const samePost = (a, b) => POST_FIELDS.every(k => (a[k] ?? null) === (b[k] ?? null)) && new Date(a.date).getTime() === new Date(b.date).getTime();
export async function pendingPosts(db) {
  await ensureStaging(db);
  const [work, live, wf, lf] = await Promise.all([
    db.collection(WORK.posts).find({}).toArray(), db.collection(LIVE.posts).find({}).toArray(),
    db.collection(WORK.flags).find({}).toArray(), db.collection(LIVE.flags).find({}).toArray(),
  ]);
  const liveById = new Map(live.map(p => [String(p._id), p]));
  const workIds = new Set(work.map(p => String(p._id)));
  const flagKey = (f) => `${f._id}:${!!f.hidden}:${!!f.pinned}`;
  const liveFlags = new Set(lf.map(flagKey));
  return {
    added: work.filter(p => !liveById.has(String(p._id))).map(p => p.title),
    changed: work.filter(p => liveById.has(String(p._id)) && !samePost(p, liveById.get(String(p._id)))).map(p => p.title),
    removed: live.filter(p => !workIds.has(String(p._id))).map(p => p.title),
    flags: wf.filter(f => !liveFlags.has(flagKey(f))).length + lf.filter(f => !wf.some(w => flagKey(w) === flagKey(f))).length,
  };
}

// Kirakás / elvetés: a munkapéldány és a kirakott másolat egyikét a másikra cseréli
async function copyCollection(db, from, to) {
  const docs = await db.collection(from).find({}).toArray();
  await db.collection(to).deleteMany({});
  if (docs.length) await db.collection(to).insertMany(docs);
}
export async function publishPosts(db) {
  await ensureStaging(db);
  await copyCollection(db, WORK.posts, LIVE.posts);
  await copyCollection(db, WORK.flags, LIVE.flags);
}
export async function discardPosts(db) {
  await ensureStaging(db);
  await copyCollection(db, LIVE.posts, WORK.posts);
  await copyCollection(db, LIVE.flags, WORK.flags);
}

// Egy hír címe a listákban: a kirakott hírnél a cím, a behúzottnál a szöveg első sora
export function postHeading(p) {
  if (p.title) return p.title;
  const first = p.text.split('\n').map(l => l.trim()).find(Boolean) || '';
  return first.length > 90 ? `${first.slice(0, 88).trimEnd()}…` : first;
}

// A kártyán a cím alatti szöveg (a behúzott posztnál az első sor már a cím)
export function postExcerpt(p, max = 220) {
  const body = p.title ? p.text : p.text.split('\n').map(l => l.trim()).filter(Boolean).slice(1).join(' ');
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 2).trimEnd()}…` : flat;
}

// Hova visz a hír: a kirakott hír a saját oldalára, a behúzott az eredeti posztra
export const postHref = (p) => (p.source === 'manual' ? `/hirek/${p.id}` : p.url);

const MONTHS = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
export function postDate(iso) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Budapest', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date(iso)).map(x => [x.type, x.value]));
  return `${p.year}. ${MONTHS[Number(p.month) - 1]} ${Number(p.day)}.`;
}
