// A hírek: a kézzel kirakott bejegyzések (website_posts) és a Facebookról / Instagramról behúzott posztok egy listában.
// A behúzott posztokat a szerkesztő elrejtheti vagy kiemelheti (website_post_flags, kulcs: "facebook:<id>").
// A kiemelt hírek elöl állnak, a többi a dátum szerint, legújabb elöl.
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

async function loadAll({ includeDrafts }) {
  const db = hasDatabase() ? await getTavernDb().catch((err) => { console.error('hírek: adatbázis hiba', err); return null; }) : null;
  const [manual, flags, facebook, instagram] = await Promise.all([
    db ? db.collection('website_posts').find(includeDrafts ? {} : { published: true }).sort({ date: -1 }).limit(60).toArray() : [],
    db ? db.collection('website_post_flags').find({}).toArray() : [],
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

// A nyilvános hírfolyam (elrejtett és piszkozat nélkül). Hiba esetén üres lista.
export async function getFeed(limit = 6) {
  try {
    return (await loadAll({ includeDrafts: false })).filter(p => !p.hidden).slice(0, limit);
  } catch (err) {
    console.error('hírek betöltése:', err);
    return [];
  }
}

// A szerkesztőfelület listája: minden, a piszkozatok és az elrejtett posztok is
export const getAllForEditor = () => loadAll({ includeDrafts: true });

// Egy kirakott hír a saját oldalához (csak közzétett)
export async function getManualPost(id) {
  if (!hasDatabase() || !ObjectId.isValid(id) || String(id).length !== 24) return null;
  const db = await getTavernDb();
  const p = await db.collection('website_posts').findOne({ _id: new ObjectId(id), published: true });
  return p ? manualPost(p) : null;
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
