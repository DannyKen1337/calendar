import Link from 'next/link';
import { notFound } from 'next/navigation';
import SubPage from '@/weblap/components/SubPage';
import { getManualPost, postDate, postExcerpt } from '@/weblap/lib/posts';
import { getContent } from '@/weblap/lib/content';
import s from '@/weblap/home.module.css';
import { withBase } from '@/weblap/lib/basePath';

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const { id } = await params;
  const p = await getManualPost(id).catch(() => null);
  if (!p) return { title: 'Hírek – Tavern' };
  const description = postExcerpt(p, 160);
  return { title: `${p.title} – Tavern`, description, openGraph: { title: p.title, description, ...(p.image ? { images: [p.image] } : {}) } };
}

// Egy kirakott hír: üres sor = új bekezdés, sortörés = sortörés
export default async function NewsPost({ params }) {
  const { id } = await params;
  const [p, { general }] = await Promise.all([getManualPost(id).catch(() => null), getContent()]);
  if (!p) notFound();
  const paragraphs = p.text.split(/\n\s*\n/).map(t => t.trim()).filter(Boolean);
  return (
    <SubPage>
      <article className={`${s.section} ${s.article}`} aria-labelledby="post-title">
        <p className={s.postMeta}><Link href={withBase('/hirek')}>← {general.nav.hirek || 'Hírek'}</Link><time dateTime={p.date}>{postDate(p.date)}</time></p>
        <h1 id="post-title" className={s.articleTitle}>{p.title}</h1>
        {p.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={s.articleImage} src={p.image} alt="" referrerPolicy="no-referrer" />
        )}
        <div className={s.articleText}>
          {paragraphs.map((para, i) => (
            <p key={i}>{para.split('\n').flatMap((line, j) => (j ? [<br key={j} />, line] : [line]))}</p>
          ))}
        </div>
        {p.url && <a className={s.btn} href={p.url}>Részletek</a>}
      </article>
    </SubPage>
  );
}
