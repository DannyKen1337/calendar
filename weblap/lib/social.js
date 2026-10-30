// A Facebook-oldal és az Instagram-fiók legutóbbi posztjai a Meta Graph API-n keresztül.
// Beállítás (környezeti változók):
//   META_ACCESS_TOKEN  a Facebook-oldal hosszú lejáratú oldal-tokenje (pages_read_engagement, instagram_basic jog)
//   FB_PAGE_ID         a Facebook-oldal azonosítója
//   IG_USER_ID         az oldalhoz kapcsolt Instagram üzleti / alkotói fiók azonosítója
// Ha valamelyik hiányzik, az a forrás egyszerűen kimarad (a kézzel kirakott hírek akkor is látszanak).
// A lekérést a szerver 15 percig gyorsítótárazza; a képek URL-jei a Metánál pár nap után lejárnak, ezért nem mentjük el őket.
import 'server-only';

const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v23.0'}`;
const REVALIDATE = 900;

async function graph(path, params) {
  const token = process.env.META_ACCESS_TOKEN;
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

export async function getFacebookPosts(limit = 12) {
  const id = process.env.FB_PAGE_ID;
  if (!id) return [];
  const data = await graph(`${id}/posts`, { fields: 'id,message,created_time,permalink_url,full_picture', limit: String(limit) });
  return (data || [])
    .filter(p => p.message || p.full_picture)
    .map(p => ({ source: 'facebook', id: p.id, text: p.message || '', image: p.full_picture || null, url: p.permalink_url, date: new Date(p.created_time).toISOString() }));
}

export async function getInstagramPosts(limit = 12) {
  const id = process.env.IG_USER_ID;
  if (!id) return [];
  const data = await graph(`${id}/media`, { fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp', limit: String(limit) });
  return (data || []).map(p => ({
    source: 'instagram',
    id: p.id,
    text: p.caption || '',
    // Videónál a borítókép, képnél és albumnál az (első) kép
    image: p.media_type === 'VIDEO' ? p.thumbnail_url || null : p.media_url || null,
    url: p.permalink,
    date: new Date(p.timestamp).toISOString(),
  }));
}

export const socialConfigured = () => ({
  facebook: !!(process.env.META_ACCESS_TOKEN && process.env.FB_PAGE_ID),
  instagram: !!(process.env.META_ACCESS_TOKEN && process.env.IG_USER_ID),
});
