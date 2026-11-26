import { GalleryIndex } from '@/weblap/components/GalleryPages';
import { getContent } from '@/weblap/lib/content';

// Kérésenként renderelődik (a CSP nonce-a miatt, lásd app/(weblap)/layout.js)
export const dynamic = 'force-dynamic';

// A Galéria oldal (élesben): eseményenként egy album
export async function generateMetadata() {
  const { albums } = await getContent();
  return { title: `${albums.title} – Tavern`, description: albums.lead };
}

export default async function Gallery() {
  return <GalleryIndex content={await getContent()} />;
}
