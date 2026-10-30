"use client";
import Link from 'next/link';
import { ConfigProvider, theme } from 'antd';
import s from './AdminPage.module.css';

// Az admin aloldalainak közös kerete (Generátor, Check-in, Előrendelés, Ligák, Statisztika, Felhasználók, Rendszer,
// Telítettség), a tulajdonosi admin (OwnerAdmin) kinézetével: egyszerű, sötét, gyors. Felül sáv a visszalépéssel,
// alatta a cím és az oldal tartalma. width: 'narrow' (űrlapok, check-in), 'normal' vagy 'wide' (táblázatok).

// Az admin felületek antd témája: a tulajdonosi admin színei (arany csak a fő gombon és a kiemelt adaton)
export const adminTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#e5b15d',
    colorBgBase: '#0f0b0c',
    colorBgContainer: '#191314',
    colorBgElevated: '#1d1517',
    colorBorder: '#3a2d30',
    colorBorderSecondary: '#241b1d',
    colorText: '#f3ece3',
    colorTextSecondary: '#b8aca7',
    colorTextTertiary: '#9a8d89',
    colorTextHeading: '#f3ece3',
    colorLink: '#e5b15d',
    colorError: '#ef7b74',
    borderRadius: 8,
    fontFamily: 'var(--font-manrope), system-ui, sans-serif',
  },
  components: {
    Modal: { contentBg: '#1d1517', headerBg: '#1d1517', titleColor: '#f3ece3' },
    Table: { colorBgContainer: '#191314', headerBg: '#191314', headerColor: '#9a8d89', borderColor: '#241b1d', rowHoverBg: '#1d1617' },
    Input: { colorBgContainer: '#2a2022' },
    InputNumber: { colorBgContainer: '#2a2022' },
    Select: { colorBgContainer: '#2a2022' },
    DatePicker: { colorBgContainer: '#2a2022' },
    Tabs: { itemSelectedColor: '#f3ece3', inkBarColor: '#e5b15d', itemColor: '#9a8d89', itemHoverColor: '#f3ece3' },
    Segmented: { itemSelectedBg: '#f3ece3', itemSelectedColor: '#120d0e', trackBg: '#191314' },
    Button: { primaryColor: '#120d0e', defaultBg: '#2a2022', defaultBorderColor: '#2a2022', defaultColor: '#f3ece3' },
  },
};

const WIDTHS = { narrow: s.narrow, normal: s.normal, wide: s.wide };

export function AdminLoading() {
  return <div className={s.loading}>Betöltés…</div>;
}

export default function AdminPage({ title, sub, actions, width = 'normal', back = '/admin', backLabel = 'Admin', children }) {
  return (
    <ConfigProvider theme={adminTheme}>
      {/* iPhone: a 16 px alatti beviteli mezőkbe koppintva a Safari ránagyít; az ablakokban (antd) is legyen 16 px */}
      <style>{'@media (pointer: coarse) { .ant-input, .ant-input-affix-wrapper input, .ant-input-number-input, .ant-select-selection-search-input, .ant-select-selection-item, .ant-picker input, textarea.ant-input { font-size: 16px !important; } }'}</style>
      <div className={s.shell}>
        <header className={s.topbar}>
          <Link href={back} className={s.back}>‹ {backLabel}</Link>
          <b className={s.topTitle}>{title}</b>
          <span className={s.topSpacer} />
        </header>
        <main className={`${s.main} ${WIDTHS[width] || s.normal}`}>
          <div className={s.titleRow}>
            <div className={s.titleText}>
              <h1 className={s.title}>{title}</h1>
              {sub && <p className={s.sub}>{sub}</p>}
            </div>
            {actions && <div className={s.actions}>{actions}</div>}
          </div>
          {children}
        </main>
      </div>
    </ConfigProvider>
  );
}
