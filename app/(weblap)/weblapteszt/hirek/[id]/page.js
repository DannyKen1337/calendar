import { NewsPost } from '@/weblap/components/NewsPages';
import { getManualPost, postExcerpt } from '@/weblap/lib/posts';
import { getContent } from '@/weblap/lib/content';

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const { id } = await params;
  const p = await getManualPost(id).catch(() => null);
  if (!p) return { title: 'Hírek – Tavern' };
  const description = postExcerpt(p, 160);
  return { title: `${p.title} – Tavern`, description, openGraph: { title: p.title, description, ...(p.image ? { images: [p.image] } : {}) } };
}

// Egy kirakott hír (élesben)
export default async function NewsPostPage({ params }) {
  const { id } = await params;
  return <NewsPost id={id} content={await getContent()} />;
}
