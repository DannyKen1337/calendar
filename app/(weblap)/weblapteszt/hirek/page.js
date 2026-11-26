import { NewsIndex } from '@/weblap/components/NewsPages';
import { getContent } from '@/weblap/lib/content';

// Kérésenként renderelődik (a CSP nonce-a miatt, lásd app/(weblap)/layout.js)
export const dynamic = 'force-dynamic';

// A Hírek oldal (élesben); a szövegek a tartalom „Hírek rész” fülén szerkeszthetők
export async function generateMetadata() {
  const { news } = await getContent();
  return { title: `${news.pageTitle} – Tavern`, description: news.pageLead };
}

export default async function News() {
  return <NewsIndex content={await getContent()} />;
}
