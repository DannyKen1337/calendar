import { GalleryIndex } from '@/weblap/components/GalleryPages';
import { getContent } from '@/weblap/lib/content';

// A Galéria oldal (élesben): eseményenként egy album
export async function generateMetadata() {
  const { albums } = await getContent();
  return { title: `${albums.title} – Tavern`, description: albums.lead };
}

export const revalidate = 300;

export default async function Gallery() {
  return <GalleryIndex content={await getContent()} />;
}
