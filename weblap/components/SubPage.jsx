import { cinzel, manrope } from '@/weblap/lib/fonts';
import { CALENDAR_URL } from '@/weblap/lib/calendar';
import { SECTIONS, WEBSHOP_URL } from '@/weblap/lib/site';
import SiteNav from '@/weblap/components/SiteNav';
import s from '@/weblap/home.module.css';

// Az aloldalak (Hírek) kerete: a főoldal fejléce (a gyorsgombok a főoldal részeire visznek) és stílusa, nyitóképernyő nélkül
export default function SubPage({ children }) {
  return (
    <div className={`${cinzel.variable} ${manrope.variable} ${s.page} ${s.subPage}`}>
      <SiteNav s={s} home={false} links={SECTIONS} extra={WEBSHOP_URL ? [{ href: WEBSHOP_URL, label: 'Webshop ↗' }] : []} cta={{ href: CALENDAR_URL, label: 'Naptár' }} />
      <main>{children}</main>
    </div>
  );
}
