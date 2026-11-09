import { NewsIndex } from '@/weblap/components/NewsPages';
import { getContent } from '@/weblap/lib/content';

// A Hírek oldal (élesben); a szövegek a tartalom „Hírek rész” fülén szerkeszthetők
export async function generateMetadata() {
  const { news } = await getContent();
  return { title: `${news.pageTitle} – Tavern`, description: news.pageLead };
}

export const revalidate = 300;

export default async function News() {
  return <NewsIndex content={await getContent()} />;
}
