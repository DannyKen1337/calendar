import { GalleryAlbum, getAlbum } from '@/weblap/components/GalleryPages';
import { getContent } from '@/weblap/lib/content';

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const [{ id }, content] = await Promise.all([params, getContent()]);
  const a = getAlbum(content, id);
  if (!a) return { title: `${content.albums.title} – Tavern` };
  const cover = a.pictures.find(p => p.picture?.src)?.picture;
  return { title: `${a.title} – ${content.albums.title} – Tavern`, openGraph: { title: a.title, ...(cover?.src?.startsWith('http') ? { images: [cover.src] } : {}) } };
}

// Egy album (élesben)
export default async function AlbumPage({ params }) {
  const [{ id }, content] = await Promise.all([params, getContent()]);
  return <GalleryAlbum id={id} content={content} />;
}
