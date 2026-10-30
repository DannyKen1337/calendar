"use client";
import Link from 'next/link';
import {
  CopyOutlined, MobileOutlined, ShoppingCartOutlined, TrophyOutlined, BarChartOutlined, TeamOutlined,
  DashboardOutlined, GlobalOutlined, CalendarOutlined, PieChartOutlined,
} from '@ant-design/icons';
import s from './QuickActions.module.css';

const WEBSITE_ADMIN = `${process.env.NEXT_PUBLIC_WEBSITE_URL || '/weblapteszt'}/admin`;

// Az admin gyors gombjai a bejelentkezett felhasználó rangja és jogai szerint:
// mindenkinek Generátor, Check-in, Statisztika, Naptár; az Előrendelés, a Ligák, a Weboldal és a Felhasználók csak annak,
// akinek a csoportja megadja; a Napi telítettség, ha a modul be van kapcsolva (a tulajdonosnak saját fülön van);
// a Rendszer csak a tulajdonosnak.
// layout: 'bar' (a tulajdonosi kezdőoldal: gépen egy sorban) vagy 'sidebar' (a szervezői oldalsáv: három oszlop)
export function quickActionsFor(app) {
  const owner = app.userRole === 'owner';
  const has = (f) => owner || app.hasFeature(f);
  return [
    ['Generátor', '/admin/generator', CopyOutlined],
    ['Check-in', '/admin/checkin', MobileOutlined],
    has('preorders') && ['Előrendelés', '/admin/elorendeles', ShoppingCartOutlined],
    has('leagues') && ['Ligák', '/admin/liga', TrophyOutlined],
    ['Statisztika', '/admin/statisztika', BarChartOutlined],
    !owner && app.occupancy?.enabled && ['Telítettség', '/admin/telitettseg', PieChartOutlined],
    has('users') && ['Felhasználók', '/admin/felhasznalok', TeamOutlined],
    owner && ['Rendszer', '/admin/rendszer', DashboardOutlined],
    has('website') && ['Weboldal', WEBSITE_ADMIN, GlobalOutlined, true],
    ['Naptár', '/', CalendarOutlined, true],
  ].filter(Boolean);
}

export default function QuickActions({ app, layout = 'bar' }) {
  const items = quickActionsFor(app);
  return (
    <nav className={`${s.quick} ${layout === 'sidebar' ? s.sidebar : s.bar}`} style={{ '--n': items.length }} aria-label="Gyors gombok">
      {items.map(([label, href, Icon, external]) => (external
        ? <a key={href} href={href} className={s.btn}><Icon aria-hidden="true" /><span>{label}</span></a>
        : <Link key={href} href={href} className={s.btn}><Icon aria-hidden="true" /><span>{label}</span></Link>))}
    </nav>
  );
}
