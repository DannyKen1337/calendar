import SubPage from '@/weblap/components/SubPage';
import PostCard from '@/weblap/components/PostCard';
import { getFeed } from '@/weblap/lib/posts';
import { getContent } from '@/weblap/lib/content';
import s from '@/weblap/home.module.css';

// A szövegek a tartalom „Hírek rész” fülén szerkeszthetők
export async function generateMetadata() {
  const { news } = await getContent();
  return { title: `${news.pageTitle} – Tavern`, description: news.pageLead };
}

export const revalidate = 300;

export default async function News() {
  const [{ general, news }, posts] = await Promise.all([getContent(), getFeed(30)]);
  const social = [general.facebook && { href: general.facebook, label: 'Facebook ↗' }, general.instagram && { href: general.instagram, label: 'Instagram ↗' }].filter(Boolean);
  return (
    <SubPage>
      <section className={s.section} aria-labelledby="news-title">
        <div className={s.sectionHead}>
          <h1 id="news-title" className={s.h2}>{news.pageTitle}</h1>
          {news.pageLead && <p className={s.sectionLead}>{news.pageLead}</p>}
        </div>
        {posts.length ? (
          <div className={s.posts}>{posts.map(p => <PostCard key={p.key} post={p} s={s} />)}</div>
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
