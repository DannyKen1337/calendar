import Link from 'next/link';
import { notFound } from 'next/navigation';
import SubPage from '@/weblap/components/SubPage';
import PostCard from '@/weblap/components/PostCard';
import { getFeed, getManualPost, postDate } from '@/weblap/lib/posts';
import { STORE_IDS } from '@/weblap/lib/contentSchema';
import { withBase } from '@/weblap/lib/basePath';
import s from '@/weblap/fooldal.module.css';

// A Hírek oldal és egy hír oldala, élesben és az előnézetben is (preview: { bar, base }).
// A szövegek a tartalom „Hírek rész” fülén szerkeszthetők.

export async function NewsIndex({ content, preview = null }) {
  const { general, news, stores } = content;
  const posts = await getFeed(30, { preview: !!preview });
  const social = [
    ...STORE_IDS.filter(id => stores[id]?.facebook).map(id => ({ href: stores[id].facebook, label: `${stores[id].name} ↗` })),
    general.instagram && { href: general.instagram, label: 'Instagram ↗' },
  ].filter(Boolean);
  return (
    <SubPage content={content} preview={preview}>
      <section className={s.section} aria-labelledby="news-title">
        <div className={s.sectionHead}>
          <h1 id="news-title" className={s.h2}>{news.pageTitle}</h1>
          {news.pageLead && <p className={s.sectionLead}>{news.pageLead}</p>}
        </div>
        {posts.length ? (
          <div className={s.postList}>{posts.map(p => <PostCard key={p.key} post={p} s={s} base={preview?.base || ''} />)}</div>
        ) : (
          <p className={s.postsEmpty}>{news.pageEmpty}</p>
        )}
        {social.length > 0 && (
          <div className={s.postsMore}>
            {social.map(l => <a key={l.href} className={s.textlink} href={l.href}>{l.label}</a>)}
          </div>
        )}
      </section>
    </SubPage>
  );
}

// Egy kirakott hír: üres sor = új bekezdés, sortörés = sortörés
export async function NewsPost({ id, content, preview = null }) {
  const p = await getManualPost(id, { preview: !!preview }).catch(() => null);
  if (!p) notFound();
  const paragraphs = p.text.split(/\n\s*\n/).map(t => t.trim()).filter(Boolean);
  return (
    <SubPage content={content} preview={preview}>
      <article className={`${s.section} ${s.article}`} aria-labelledby="post-title">
        <p className={s.postMeta}><Link href={withBase(`${preview?.base || ''}/hirek`)}>← {content.general.nav.hirek || 'Hírek'}</Link><time dateTime={p.date}>{postDate(p.date)}</time></p>
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
