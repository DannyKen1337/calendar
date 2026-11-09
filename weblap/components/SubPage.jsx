import { bigShoulders, publicSans } from '@/weblap/lib/fonts';
import { getContent } from '@/weblap/lib/content';
import { navProps } from '@/weblap/lib/site';
import SiteNav from '@/weblap/components/SiteNav';
import s from '@/weblap/fooldal.module.css';

// Az aloldalak (Hírek) kerete: a főoldal fejléce (balra a cégér, a gyorsgombok a főoldal részeire visznek) és stílusa
export default async function SubPage({ children }) {
  const content = await getContent();
  return (
    <div className={`${bigShoulders.variable} ${publicSans.variable} ${s.page} ${s.subPage}`}>
      <SiteNav home={false} {...navProps(content)} />
      <main>{children}</main>
    </div>
  );
}
