// A boltok Facebook-oldalainak és az Instagram-fióknak a legutóbbi posztjai a Meta Graph API-n keresztül.
// Beállítás (környezeti változók):
//   META_PAGES         a boltok Facebook-oldalai JSON-ben, mindegyik a saját oldal-tokenjével (pages_read_engagement jog):
//                      [{"store":"debrecen","id":"<oldal-azonosító>","token":"<oldal-token>"}, {"store":"jatekceh",...}, {"store":"miskolc",...}]
//   META_ACCESS_TOKEN  egyetlen oldal tokenje (a régi beállítás, ilyenkor az FB_PAGE_ID a debreceni bolté); az Instagramhoz is ez kell
//   FB_PAGE_ID         egyetlen Facebook-oldal azonosítója (ha nincs META_PAGES)
//   IG_USER_ID         az oldalhoz kapcsolt Instagram üzleti / alkotói fiók azonosítója
// Ha valamelyik hiányzik, az a forrás egyszerűen kimarad (a kézzel kirakott hírek akkor is látszanak).
// A lekérést a szerver 15 percig gyorsítótárazza; a képek URL-jei a Metánál pár nap után lejárnak, ezért nem mentjük el őket.
import 'server-only';

const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v23.0'}`;
const REVALIDATE = 900;

async function graph(path, params, token = process.env.META_ACCESS_TOKEN) {
  if (!token) return null;
  const qs = new URLSearchParams({ ...params, access_token: token });
  try {
    const res = await fetch(`${GRAPH}/${path}?${qs}`, { next: { revalidate: REVALIDATE, tags: ['social'] } });
    if (!res.ok) {
      console.error(`Meta Graph API hiba (${path}):`, res.status, (await res.text()).slice(0, 300));
      return null;
    }
    return (await res.json()).data || [];
  } catch (err) {
    console.error(`Meta Graph API hiba (${path}):`, err);
    return null;
  }
}

// A beállított Facebook-oldalak: [{ store, id, token }]
function facebookPages() {
  if (process.env.META_PAGES) {
    try {
      const list = JSON.parse(process.env.META_PAGES);
      return (Array.isArray(list) ? list : []).filter(p => p && p.id && p.token).map(p => ({ store: String(p.store || ''), id: String(p.id), token: String(p.token) }));
    } catch (err) {
      console.error('META_PAGES: hibás JSON', err.message);
      return [];
    }
  }
  return process.env.FB_PAGE_ID && process.env.META_ACCESS_TOKEN ? [{ store: 'debrecen', id: process.env.FB_PAGE_ID, token: process.env.META_ACCESS_TOKEN }] : [];
}

// Minden beállított oldal posztjai együtt; mindegyik poszt tudja, melyik bolté (store)
export async function getFacebookPosts(limit = 12) {
  const lists = await Promise.all(facebookPages().map(async (page) => {
    // attachments: a több képes (album) posztok összes képe (images); egy képnél csak a full_picture
    const data = await graph(`${page.id}/posts`, { fields: 'id,message,created_time,permalink_url,full_picture,attachments{media,subattachments.limit(10){media}}', limit: String(limit) }, page.token);
    return (data || [])
      .filter(p => p.message || p.full_picture)
      .map(p => {
        const att = p.attachments?.data?.[0];
        const subs = (att?.subattachments?.data || []).map(a => a.media?.image?.src).filter(Boolean);
        const images = subs.length ? subs : p.full_picture ? [p.full_picture] : [];
        return { source: 'facebook', store: page.store, id: p.id, text: p.message || '', image: images[0] || null, images, url: p.permalink_url, date: new Date(p.created_time).toISOString() };
      });
  }));
  return lists.flat();
}

export async function getInstagramPosts(limit = 12) {
  const id = process.env.IG_USER_ID;
  if (!id) return [];
  const data = await graph(`${id}/media`, { fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_type,media_url,thumbnail_url}', limit: String(limit) });
  // Videónál a borítókép, képnél a kép, albumnál (CAROUSEL_ALBUM) az összes kép
  const pic = (m) => (m.media_type === 'VIDEO' ? m.thumbnail_url || null : m.media_url || null);
  return (data || []).map(p => {
    const images = (p.children?.data?.length ? p.children.data.map(pic) : [pic(p)]).filter(Boolean);
    return {
      source: 'instagram',
      id: p.id,
      text: p.caption || '',
      image: images[0] || null,
      images,
      url: p.permalink,
      date: new Date(p.timestamp).toISOString(),
    };
  });
}

export const socialConfigured = () => ({
  facebook: facebookPages().length > 0,
  instagram: !!(process.env.META_ACCESS_TOKEN && process.env.IG_USER_ID),
});
