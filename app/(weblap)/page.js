import HomePage from '@/weblap/components/HomePage';
import { getFeed } from '@/weblap/lib/posts';
import { getContent } from '@/weblap/lib/content';

// Az éles főoldal: a kirakott tartalom és hírek (a szerkesztés előbb az előnézetben látszik: /weblapteszt/elonezet).
// Minden szöveg, kép és link a szerkeszthető tartalomból jön (weblap/lib/content.js; a szerkesztőfelület fülei).
export async function generateMetadata() {
  const { general } = await getContent();
  return { title: general.title, description: general.description };
}

// Sötét oldal: a böngésző sávja és az oldal szélén túlgörgetés is a korom fekete
export const viewport = { themeColor: '#0f0f0f', colorScheme: 'dark' };

// Kérésenként renderelődik (a CSP nonce-a miatt, lásd app/(weblap)/layout.js); a naptár programja és a Facebook-posztok
// adat-gyorsítótára 5 perces marad (weblap/lib/calendar.js, social.js)
export const dynamic = 'force-dynamic';

export default async function Home() {
  const [content, feed] = await Promise.all([getContent(), getFeed(8)]);
  return <HomePage content={content} feed={feed} />;
}
