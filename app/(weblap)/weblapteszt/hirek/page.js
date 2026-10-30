import SubPage from '@/weblap/components/SubPage';
import PostCard from '@/weblap/components/PostCard';
import { getFeed } from '@/weblap/lib/posts';
import { FB, IG } from '@/weblap/lib/site';
import s from '@/weblap/home.module.css';

export const metadata = {
  title: 'Hírek – Tavern',
  description: 'Hírek a Tavern boltjaiból: új kiadások, versenyek, programok.',
};

export const revalidate = 300;

export default async function News() {
  const posts = await getFeed(30);
  return (
    <SubPage>
      <section className={s.section} aria-labelledby="news-title">
        <div className={s.sectionHead}>
          <h1 id="news-title" className={s.h2}>Hírek a boltokból</h1>
          <p className={s.sectionLead}>Új kiadások, versenyeredmények, programok. Facebookon és Instagramon is ezeket posztoljuk.</p>
        </div>
        {posts.length ? (
          <div className={s.posts}>{posts.map(p => <PostCard key={p.key} post={p} s={s} />)}</div>
        ) : (
          <p className={s.postsEmpty}>Hamarosan itt is olvashatod a híreinket. Addig keress minket a <a href={FB}>Facebookon</a> és az <a href={IG}>Instagramon</a>.</p>
        )}
        <div className={s.postsMore}>
          <a className={s.textlink} href={FB}>Facebook ↗</a>
          <a className={s.textlink} href={IG}>Instagram ↗</a>
        </div>
      </section>
    </SubPage>
  );
}
