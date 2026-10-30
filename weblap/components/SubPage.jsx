import { cinzel, manrope } from '@/weblap/lib/fonts';
import { getContent } from '@/weblap/lib/content';
import { navProps } from '@/weblap/lib/site';
import SiteNav from '@/weblap/components/SiteNav';
import s from '@/weblap/home.module.css';

// Az aloldalak (Hírek) kerete: a főoldal fejléce (a gyorsgombok a főoldal részeire visznek) és stílusa, nyitóképernyő nélkül
export default async function SubPage({ children }) {
  const content = await getContent();
  return (
    <div className={`${cinzel.variable} ${manrope.variable} ${s.page} ${s.subPage}`}>
      <SiteNav s={s} home={false} {...navProps(content)} />
      <main>{children}</main>
    </div>
  );
}
