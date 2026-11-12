import { bigShoulders, publicSans } from '@/weblap/lib/fonts';
import { navProps } from '@/weblap/lib/site';
import { withBase } from '@/weblap/lib/basePath';
import SiteNav from '@/weblap/components/SiteNav';
import s from '@/weblap/fooldal.module.css';

// Az aloldalak (Hírek) kerete: a főoldal fejléce (balra a cégér, a gyorsgombok a főoldal részeire visznek) és stílusa.
// preview: { bar, base } az előnézetben (a sáv, és hogy a linkek az előnézet főoldalára vigyenek)
// current: melyik külön oldal ez (a menüpontja kiemelve)
export default function SubPage({ content, preview = null, current = null, children }) {
  return (
    <div className={`${bigShoulders.variable} ${publicSans.variable} ${s.page} ${s.subPage} ${preview ? s.withPreview : ''}`}>
      {preview?.bar}
      <SiteNav home={false} homeHref={withBase(preview?.base || '/')} {...navProps(content, { base: preview?.base || '', current })} />
      <main>{children}</main>
    </div>
  );
}
