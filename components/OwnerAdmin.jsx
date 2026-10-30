"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ConfigProvider, Drawer, Popconfirm, Select, Switch } from 'antd';
import {
  CalendarOutlined, HomeOutlined, AppstoreOutlined, UserOutlined, PlusOutlined, SearchOutlined, SyncOutlined, RightOutlined, LeftOutlined,
  MobileOutlined, UnorderedListOutlined, EditOutlined, CopyOutlined, LockOutlined, UnlockOutlined, DeleteOutlined, LinkOutlined, ShareAltOutlined,
  FormOutlined, BarChartOutlined, ShoppingCartOutlined, TrophyOutlined, GlobalOutlined, TeamOutlined, DashboardOutlined, StopOutlined,
  ToolOutlined, CloudDownloadOutlined, ClearOutlined, EyeOutlined, LogoutOutlined, KeyOutlined, GiftOutlined, StarFilled, CloseOutlined, FilterOutlined,
} from '@ant-design/icons';
import { tavernTheme, STORES, AdminModals, checkinPageUrl, registrationPageUrl, eventShareUrl } from '@/app/components';
import { GAME_CONFIG, getGameColor } from '@/lib/gameConfig';
import { isSpecialEvent, getEventTypeConfig } from '@/lib/eventTypes';
import { eventMatchesQuery, eventExtraSearchText } from '@/lib/eventSearch';
import { rgnEventId } from '@/lib/rgn';
import s from './OwnerAdmin.module.css';

// A tulajdonos (Admin2) admin felülete, telefonra (iPhone, Safari web app) tervezve: alul fülsáv (Ma, Események,
// Eszközök, Fiók), az események tömör sorokban, egy sorra koppintva alulról felcsúszó lapon minden teendő.
// Széles képernyőn a fülsáv bal oldali sávvá válik. Az ablakok (szerkesztés, jelentkezők, ...) a szervezői nézettel
// közösek (AdminModals). A szervezők továbbra is a régi nézetet (AdminEvents) látják.

const TABS = [
  { key: 'ma', label: 'Ma', icon: <HomeOutlined /> },
  { key: 'esemenyek', label: 'Események', icon: <CalendarOutlined /> },
  { key: 'eszkozok', label: 'Eszközök', icon: <AppstoreOutlined /> },
  { key: 'fiok', label: 'Fiók', icon: <UserOutlined /> },
];
const TAB_STORAGE = 'tavern-owner-tab';
const MONTHS = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
const WEEKDAYS = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
const SHORT_GAMES = { 'Pokémon TCG': 'Pokémon', 'One Piece Card Game': 'One Piece', 'Magic: The Gathering': 'Magic', 'Disney Lorcana': 'Lorcana', 'Flesh and Blood': 'FaB', 'CyberPunk TCG': 'CyberPunk' };
const SHORT_STORES = { debrecen: 'Debrecen', miskolc: 'Miskolc', jatekceh: 'JátékCéh' };

const eid = (e) => String(e._id || e.id);
const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const sameDay = (a, b) => dayStart(a).getTime() === dayStart(b).getTime();
const timeOf = (d) => d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const dayTitle = (d, today) => {
  const diff = Math.round((dayStart(d) - today) / 86400000);
  const date = `${MONTHS[d.getMonth()]} ${d.getDate()}., ${WEEKDAYS[d.getDay()]}`;
  return diff === 0 ? `Ma · ${date}` : diff === 1 ? `Holnap · ${date}` : cap(date);
};

// Létszám egy eseménynél: { text, ratio (0–1, ha van korlát), tone }
function capacity(e) {
  if (e.isOpenAttendance) return { text: 'Kötetlen', tone: 'muted' };
  if (e.external_url && !(rgnEventId(e.external_url) && e.rgn?.syncedAt)) return { text: 'Külső', tone: 'muted' };
  const cur = e.current_players || 0;
  const max = e.external_url ? e.rgn?.capacity : e.max_players;
  if (!max) return { text: String(cur), tone: 'plain' };
  return { text: `${cur}/${max}`, ratio: Math.min(1, cur / max), tone: cur >= max ? 'full' : 'plain' };
}

export default function OwnerAdmin({ app, onShowChangelog, unseenCount }) {
  const [tab, setTab] = useState(() => {
    if (typeof window === 'undefined') return 'ma';
    const saved = window.sessionStorage.getItem(TAB_STORAGE);
    return TABS.some(t => t.key === saved) ? saved : 'ma';
  });
  const [selected, setSelected] = useState(null); // a megnyitott esemény azonosítója (teendőlap)
  const [store, setStore] = useState('Mind');
  const [games, setGames] = useState([]);
  const [query, setQuery] = useState('');
  const [showPast, setShowPast] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [standalone, setStandalone] = useState(true);

  useEffect(() => { window.sessionStorage.setItem(TAB_STORAGE, tab); }, [tab]);
  // Web appként (főképernyőről) indítva nem kell a telepítési tipp
  useEffect(() => {
    const t = setTimeout(() => setStandalone(window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches), 0);
    return () => clearTimeout(t);
  }, []);

  const goTab = (key) => { setTab(key); window.scrollTo({ top: 0 }); };
  const refresh = async () => {
    setRefreshing(true);
    try { await app.fetchData(true); } finally { setRefreshing(false); }
  };

  const today = dayStart(new Date());
  const all = (app.tournaments || [])
    .filter(e => {
      const st = e.store || 'debrecen';
      if (store !== 'Mind' && st !== store) return false;
      if (games.length && !games.includes(e.category || 'Egyéb')) return false;
      return eventMatchesQuery(e, query, `${eventExtraSearchText(e, STORES[st]?.name)} ${app.hostNames(e).join(' ')}`);
    })
    .map(e => ({ e, d: new Date(e.date) }))
    .filter(x => !isNaN(x.d.getTime()))
    .sort((a, b) => a.d - b.d);
  const upcoming = all.filter(x => x.d >= today);
  const filtered = store !== 'Mind' || games.length > 0;

  const stats = [
    ['Közelgő esemény', upcoming.length],
    ['Jelentkező', upcoming.reduce((n, { e }) => n + (capacity(e).ratio !== undefined ? e.current_players || 0 : 0), 0)],
    ['Várólistán', upcoming.reduce((n, { e }) => n + (e.queue_count || 0), 0)],
    ['Lezárva', upcoming.filter(({ e }) => !e.is_open && !e.isOpenAttendance && !e.external_url).length],
  ];

  const selectedEvent = selected ? (app.tournaments || []).find(e => eid(e) === selected) : null;

  const openNewEvent = () => {
    app.eventForm.resetFields();
    app.eventForm.setFieldsValue({ store: app.defaultStoreFor(store !== 'Mind' ? store : undefined) });
    app.setEditingEventId(null);
    app.setIsCopyingEvent(false);
    app.setIsExternalForm(false);
    app.setIsEventModalOpen(true);
  };

  // --- Részek ---

  const eventRow = ({ e, d }, showDay = false) => {
    const c = capacity(e);
    const special = isSpecialEvent(e) ? getEventTypeConfig(e) : null;
    const closed = !e.is_open && !e.isOpenAttendance && !e.external_url;
    return (
      <li key={eid(e)}>
        <button type="button" className={s.row} style={{ '--game': getGameColor(e) }} onClick={() => setSelected(eid(e))}>
          <span className={s.rowTime}>
            <b>{timeOf(d)}</b>
            {showDay && <small>{`${MONTHS[d.getMonth()].slice(0, 3)}. ${d.getDate()}.`}</small>}
          </span>
          <span className={s.rowMain}>
            <span className={s.rowName}>
              {(e.isFeatured || special) && <span className={s.rowStar} aria-label={special ? special.label : 'Kiemelt'}>{special?.icon || <StarFilled />}</span>}
              {e.name}
            </span>
            <span className={s.rowMeta}>
              {SHORT_GAMES[e.category] || e.category || 'Egyéb'} · {SHORT_STORES[e.store || 'debrecen']}
              {app.hostNames(e).length > 0 && ` · ${app.hostNames(e).join(', ')}`}
            </span>
          </span>
          <span className={s.rowSide}>
            <span className={`${s.count} ${s[`tone_${c.tone}`]}`}>{c.text}</span>
            {c.ratio !== undefined && <span className={s.meter}><i style={{ width: `${Math.round(c.ratio * 100)}%` }} /></span>}
            {closed ? <span className={s.pill}>Lezárva</span> : e.queue_count > 0 ? <span className={s.pillWarn}>+{e.queue_count} vár</span> : null}
          </span>
        </button>
      </li>
    );
  };

  const dayGroups = (items, emptyText) => {
    if (!items.length) return <p className={s.empty}>{emptyText}</p>;
    const groups = [];
    for (const x of items) {
      const last = groups[groups.length - 1];
      if (last && sameDay(last.d, x.d)) last.items.push(x);
      else groups.push({ d: x.d, items: [x] });
    }
    return groups.map(g => (
      <section key={g.d.toDateString()} className={s.day}>
        <h3 className={`${s.dayTitle} ${sameDay(g.d, today) ? s.dayToday : ''}`}>{dayTitle(g.d, today)}<span>{g.items.length}</span></h3>
        <ul className={s.list}>{g.items.map(x => eventRow(x))}</ul>
      </section>
    ));
  };

  const header = (title, sub, action) => (
    <header className={s.head}>
      <div>
        <h1 className={s.title}>{title}</h1>
        {sub && <p className={s.sub}>{sub}</p>}
      </div>
      {action}
    </header>
  );

  const refreshButton = (
    <button type="button" className={s.roundBtn} onClick={refresh} aria-label="Frissítés" disabled={refreshing}>
      <SyncOutlined spin={refreshing} />
    </button>
  );

  // Ma: áttekintés, a mai és a következő napok eseményei
  const todayView = () => {
    const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
    const week = upcoming.filter(x => x.d < in7);
    return (
      <>
        {header('Ma', `${cap(WEEKDAYS[today.getDay()])}, ${MONTHS[today.getMonth()]} ${today.getDate()}.`, refreshButton)}
        {app.isMaintenance && (
          <button type="button" className={s.alert} onClick={() => goTab('eszkozok')}>
            <ToolOutlined /> A karbantartás be van kapcsolva: a látogatók nem tudnak jelentkezni.<RightOutlined />
          </button>
        )}
        <div className={s.stats}>
          {stats.map(([label, value]) => <div key={label} className={s.stat}><b>{value}</b><span>{label}</span></div>)}
        </div>
        <h2 className={s.sectionTitle}>A következő 7 nap</h2>
        {dayGroups(week, filtered ? 'A szűrőknek megfelelő esemény nincs a következő 7 napban.' : 'A következő 7 napban nincs esemény.')}
        {upcoming.length > week.length && (
          <button type="button" className={s.more} onClick={() => goTab('esemenyek')}>Az összes közelgő esemény ({upcoming.length})<RightOutlined /></button>
        )}
      </>
    );
  };

  // Események: hónaponként (keresésnél minden hónap), szűrőkkel
  const eventsView = () => {
    const searching = query.trim() !== '';
    const isCurrent = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();
    const inMonth = all.filter(x => x.d.getFullYear() === month.getFullYear() && x.d.getMonth() === month.getMonth());
    const hiddenPast = isCurrent && !showPast ? inMonth.filter(x => x.d < today).length : 0;
    const items = searching ? all : inMonth.filter(x => !(isCurrent && !showPast && x.d < today));
    const shift = (n) => setMonth(m => new Date(m.getFullYear(), m.getMonth() + n, 1));
    return (
      <>
        {header('Események', searching ? `${items.length} találat` : `${items.length} esemény`, refreshButton)}
        <div className={s.toolbar}>
          <label className={s.search}>
            <SearchOutlined />
            <input type="search" value={query} onChange={(ev) => setQuery(ev.target.value)} placeholder="Név, játék, szervező…" enterKeyHint="search" />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="Keresés törlése"><CloseOutlined /></button>}
          </label>
          <button type="button" className={`${s.roundBtn} ${filtered ? s.roundBtnOn : ''}`} onClick={() => setFiltersOpen(true)} aria-label="Szűrők">
            <FilterOutlined />
          </button>
        </div>
        <div className={s.chips} role="group" aria-label="Bolt">
          {['Mind', ...Object.keys(STORES)].map(id => (
            <button key={id} type="button" className={`${s.chip} ${store === id ? s.chipOn : ''}`} aria-pressed={store === id} onClick={() => setStore(id)}>
              {id === 'Mind' ? 'Mind' : SHORT_STORES[id]}
            </button>
          ))}
        </div>
        {!searching && (
          <div className={s.pager}>
            <button type="button" className={s.roundBtn} onClick={() => shift(-1)} aria-label="Előző hónap"><LeftOutlined /></button>
            <button type="button" className={s.pagerLabel} onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))} disabled={isCurrent}>
              {month.getFullYear()}. {MONTHS[month.getMonth()]}
              {!isCurrent && <small>Vissza a mostanihoz</small>}
            </button>
            <button type="button" className={s.roundBtn} onClick={() => shift(1)} aria-label="Következő hónap"><RightOutlined /></button>
          </div>
        )}
        {!searching && isCurrent && (hiddenPast > 0 || showPast) && (
          <button type="button" className={s.linkBtn} onClick={() => setShowPast(p => !p)}>
            {showPast ? 'A mai nap előttiek elrejtése' : `A hónap korábbi eseményei (${hiddenPast})`}
          </button>
        )}
        {dayGroups(items, searching ? 'Nincs találat.' : filtered ? 'A szűrőknek megfelelő esemény nincs ebben a hónapban.' : 'Ebben a hónapban nincs esemény.')}
      </>
    );
  };

  const toolRow = ({ key, icon, label, hint, href, onClick, danger, external, extra }) => {
    const inner = (
      <>
        <span className={`${s.toolIcon} ${danger ? s.toolIconDanger : ''}`}>{icon}</span>
        <span className={s.toolText}><b>{label}</b>{hint && <small>{hint}</small>}</span>
        {extra ?? <RightOutlined className={s.chev} />}
      </>
    );
    if (href) {
      return external
        ? <li key={key}><a className={`${s.tool} ${danger ? s.toolDanger : ''}`} href={href}>{inner}</a></li>
        : <li key={key}><Link className={`${s.tool} ${danger ? s.toolDanger : ''}`} href={href}>{inner}</Link></li>;
    }
    return <li key={key}><button type="button" className={`${s.tool} ${danger ? s.toolDanger : ''}`} onClick={onClick}>{inner}</button></li>;
  };

  // Eszközök: minden, ami nem egy eseményhez tartozik
  const toolsView = () => (
    <>
      {header('Eszközök')}
      <h2 className={s.groupTitle}>Események</h2>
      <ul className={s.group}>
        {toolRow({ key: 'uj', icon: <PlusOutlined />, label: 'Új esemény', onClick: openNewEvent })}
        {toolRow({ key: 'gen', icon: <CalendarOutlined />, label: 'Generátor', hint: 'Ismétlődő események egyszerre', href: '/admin/generator' })}
        {toolRow({ key: 'checkin', icon: <MobileOutlined />, label: 'Check-in', href: '/admin/checkin' })}
        {toolRow({ key: 'stat', icon: <BarChartOutlined />, label: 'Statisztika', href: '/admin/statisztika' })}
        {toolRow({ key: 'naptar', icon: <EyeOutlined />, label: 'Nyilvános naptár', href: '/', external: true })}
      </ul>
      <h2 className={s.groupTitle}>Modulok</h2>
      <ul className={s.group}>
        {toolRow({ key: 'pre', icon: <ShoppingCartOutlined />, label: 'Előrendelés', href: '/admin/elorendeles' })}
        {toolRow({ key: 'liga', icon: <TrophyOutlined />, label: 'Ligák', href: '/admin/liga' })}
        {toolRow({ key: 'web', icon: <GlobalOutlined />, label: 'Weboldal', hint: 'Hírek és az oldal tartalma', href: `${process.env.NEXT_PUBLIC_WEBSITE_URL || '/weblapteszt'}/admin`, external: true })}
      </ul>
      <h2 className={s.groupTitle}>Tulajdonos</h2>
      <ul className={s.group}>
        {toolRow({ key: 'users', icon: <TeamOutlined />, label: 'Felhasználók és csoportok', href: '/admin/felhasznalok' })}
        {toolRow({ key: 'sys', icon: <DashboardOutlined />, label: 'Rendszer és napló', href: '/admin/rendszer' })}
        {toolRow({ key: 'ban', icon: <StopOutlined />, label: 'Feketelista', hint: `${(app.blacklist || []).length} tiltott e-mail`, onClick: () => app.setIsBlacklistModalOpen(true) })}
        <li key="maint">
          <div className={s.tool}>
            <span className={`${s.toolIcon} ${app.isMaintenance ? s.toolIconDanger : ''}`}><ToolOutlined /></span>
            <span className={s.toolText}><b>Karbantartás</b><small>{app.isMaintenance ? 'Bekapcsolva: nem lehet jelentkezni' : 'Kikapcsolva'}</small></span>
            <Popconfirm title={`Biztosan ${app.isMaintenance ? 'kikapcsolod' : 'bekapcsolod'} a karbantartást?`} onConfirm={() => app.toggleMaintenance(!app.isMaintenance)} okText="Igen" cancelText="Mégse">
              <Switch checked={!!app.isMaintenance} aria-label="Karbantartás" />
            </Popconfirm>
          </div>
        </li>
      </ul>
      <h2 className={s.groupTitle}>Adatok</h2>
      <ul className={s.group}>
        {toolRow({ key: 'backup', icon: <CloudDownloadOutlined />, label: 'Teljes adatbázis mentés', hint: 'JSON fájl letöltése', onClick: app.handleExportDB })}
        <li key="cleanup">
          <Popconfirm title="Biztosan törlöd a 2 hónapnál régebbi eseményeket és jelentkezőiket?" onConfirm={app.handleCleanupOldEvents} okText="Törlés" cancelText="Mégse" okButtonProps={{ danger: true }}>
            <button type="button" className={`${s.tool} ${s.toolDanger}`}>
              <span className={`${s.toolIcon} ${s.toolIconDanger}`}><ClearOutlined /></span>
              <span className={s.toolText}><b>Régi események törlése</b><small>2 hónapnál régebbiek, jelentkezőikkel</small></span>
              <RightOutlined className={s.chev} />
            </button>
          </Popconfirm>
        </li>
      </ul>
    </>
  );

  // Fiók
  const accountView = () => (
    <>
      {header('Fiók')}
      <div className={s.profile}>
        <span className={s.avatar} aria-hidden="true">{(app.userName || '?').charAt(0).toUpperCase()}</span>
        <div><b>{app.userName}</b><span>Tulajdonos</span></div>
      </div>
      <ul className={s.group}>
        {toolRow({ key: 'news', icon: <GiftOutlined />, label: 'Újdonságok', onClick: onShowChangelog, extra: unseenCount > 0 ? <span className={s.badge}>{unseenCount}</span> : undefined })}
        {toolRow({ key: 'pw', icon: <KeyOutlined />, label: 'Saját jelszó', onClick: () => { app.ownPasswordForm.resetFields(); app.setIsOwnPasswordModalOpen(true); } })}
      </ul>
      <ul className={s.group}>
        {toolRow({ key: 'out', icon: <LogoutOutlined />, label: 'Kijelentkezés', danger: true, onClick: () => app.handleLogout(), extra: null })}
      </ul>
      {!standalone && (
        <p className={s.tip}>Tipp: telepítsd web appként. Safariban: Megosztás → Főképernyőhöz adás. Így teljes képernyőn, saját ikonnal nyílik.</p>
      )}
    </>
  );

  return (
    <ConfigProvider theme={tavernTheme}>
      {/* iPhone: a 16 px alatti beviteli mezőkbe koppintva a Safari ránagyít; az ablakokban (antd) is legyen 16 px */}
      <style>{'@media (pointer: coarse) { .ant-input, .ant-input-affix-wrapper input, .ant-select-selection-search-input, .ant-select-selection-item, .ant-picker input, textarea.ant-input { font-size: 16px !important; } }'}</style>
      <div className={s.shell}>
        <nav className={s.tabbar} aria-label="Admin">
          <span className={s.brand}>Tavern</span>
          {TABS.map(t => (
            <button key={t.key} type="button" className={`${s.tabBtn} ${tab === t.key ? s.tabOn : ''}`} aria-current={tab === t.key ? 'page' : undefined} onClick={() => goTab(t.key)}>
              <span className={s.tabIcon}>{t.icon}{t.key === 'fiok' && unseenCount > 0 && <i className={s.dot} />}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        <main className={s.main}>
          {tab === 'ma' && todayView()}
          {tab === 'esemenyek' && eventsView()}
          {tab === 'eszkozok' && toolsView()}
          {tab === 'fiok' && accountView()}
        </main>

        {(tab === 'ma' || tab === 'esemenyek') && (
          <button type="button" className={s.fab} onClick={openNewEvent} aria-label="Új esemény"><PlusOutlined /></button>
        )}
      </div>

      <EventSheet app={app} evt={selectedEvent} onClose={() => setSelected(null)} />

      <Drawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        placement="bottom"
        size="auto"
        title="Szűrők"
        rootClassName={s.sheetRoot}
        closeIcon={<CloseOutlined />}
      >
        <div className={s.sheetBody}>
          <p className={s.sheetLabel}>Bolt</p>
          <div className={s.chips}>
            {['Mind', ...Object.keys(STORES)].map(id => (
              <button key={id} type="button" className={`${s.chip} ${store === id ? s.chipOn : ''}`} aria-pressed={store === id} onClick={() => setStore(id)}>
                {id === 'Mind' ? 'Mind' : STORES[id].name}
              </button>
            ))}
          </div>
          <p className={s.sheetLabel}>Játék</p>
          <Select mode="multiple" allowClear value={games} onChange={setGames} placeholder="Minden játék" style={{ width: '100%' }} size="large"
            options={Object.keys(GAME_CONFIG).map(g => ({ value: g, label: g }))} />
          <div className={s.sheetActions}>
            <button type="button" className={s.secondaryBtn} onClick={() => { setStore('Mind'); setGames([]); }}>Alaphelyzet</button>
            <button type="button" className={s.primaryBtn} onClick={() => setFiltersOpen(false)}>Kész</button>
          </div>
        </div>
      </Drawer>

      <AdminModals app={app} />
    </ConfigProvider>
  );
}

// Egy esemény teendői alulról felcsúszó lapon
function EventSheet({ app, evt, onClose }) {
  const open = !!evt;
  const [last, setLast] = useState(evt);
  // Bezáráskor a lap még lecsúszik: addig az utolsó esemény maradjon rajta
  if (evt && evt !== last) setLast(evt);
  const e = evt || last;
  if (!e) return null;

  const id = eid(e);
  const d = new Date(e.date);
  const c = capacity(e);
  const hasRegs = !e.external_url && !e.isOpenAttendance;
  const isRgn = !!rgnEventId(e.external_url);
  const closed = !e.is_open;
  const run = (fn) => () => { onClose(); fn(); };

  const share = async () => {
    const url = eventShareUrl(e);
    try {
      if (navigator.share) await navigator.share({ title: e.name, url });
      else { await navigator.clipboard.writeText(url); app.messageApi?.success('Link kimásolva.'); }
    } catch { /* a megosztás bezárása nem hiba */ }
  };

  const action = (key, icon, label, props) => {
    const { href, onClick, tone, external } = props;
    const cls = `${s.action} ${tone ? s[`action_${tone}`] : ''}`;
    if (href) return external
      ? <a key={key} className={cls} href={href} target="_blank" rel="noopener noreferrer">{icon}<span>{label}</span></a>
      : <Link key={key} className={cls} href={href}>{icon}<span>{label}</span></Link>;
    return <button key={key} type="button" className={cls} onClick={onClick}>{icon}<span>{label}</span></button>;
  };

  return (
    <Drawer open={open} onClose={onClose} placement="bottom" size="auto" title={null} closable={false} rootClassName={s.sheetRoot}>
      <div className={s.sheetBody}>
        <span className={s.grabber} aria-hidden="true" />
        <div className={s.sheetHead} style={{ '--game': getGameColor(e) }}>
          <p className={s.sheetWhen}>{cap(`${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}.`)} · {timeOf(d)}</p>
          <h2 className={s.sheetTitle}>{e.name}</h2>
          <p className={s.sheetMeta}>
            {e.category || 'Egyéb'} · {STORES[e.store || 'debrecen']?.name}
            {app.hostNames(e).length > 0 && <> · Tartja: {app.hostNames(e).join(', ')}</>}
          </p>
          <p className={s.sheetMeta}>
            Létszám: <b>{c.text}</b>
            {e.queue_count > 0 && <> · várólistán {e.queue_count}</>}
            {hasRegs && <> · {closed ? 'jelentkezés lezárva' : 'jelentkezés nyitva'}</>}
          </p>
          <button type="button" className={s.sheetClose} onClick={onClose} aria-label="Bezárás"><CloseOutlined /></button>
        </div>

        <div className={s.actions}>
          {hasRegs && action('checkin', <MobileOutlined />, 'Check-in', { href: checkinPageUrl(e), tone: 'gold' })}
          {hasRegs && action('regs', <UnorderedListOutlined />, 'Jelentkezők', { onClick: run(() => { app.setSelectedEventIdForAttendees(id); app.setIsAttendeesModalOpen(true); }) })}
          {isRgn && action('rgn', <UnorderedListOutlined />, 'Riftbound jelentkezők', { onClick: run(() => app.setSelectedRgnEventId(id)) })}
          {action('edit', <EditOutlined />, 'Szerkesztés', { onClick: run(() => app.openEditEvent(e)) })}
          {hasRegs && action('gate', closed ? <UnlockOutlined /> : <LockOutlined />, app.togglingGateId === id ? 'Folyamatban…' : closed ? 'Megnyitás' : 'Lezárás', { onClick: () => app.handleToggleGate(id, closed), tone: closed ? undefined : 'warn' })}
          {action('copy', <CopyOutlined />, 'Másolás új időpontra', { onClick: run(() => app.openCopyEvent(e)) })}
          {action('share', <ShareAltOutlined />, 'Megosztás', { onClick: share })}
          {hasRegs && action('page', <FormOutlined />, 'Jelentkezési oldal', { href: registrationPageUrl(e), external: true })}
          {e.external_url && action('ext', <LinkOutlined />, isRgn ? 'Riftbound oldal' : 'Külső oldal', { href: e.external_url, external: true })}
        </div>

        <Popconfirm title="Biztosan törlöd ezt az eseményt?" description={hasRegs ? 'A jelentkezések is törlődnek.' : undefined} onConfirm={run(() => app.handleDeleteTournament(id))} okText="Törlés" cancelText="Mégse" okButtonProps={{ danger: true }}>
          <button type="button" className={s.deleteBtn}><DeleteOutlined /> Esemény törlése</button>
        </Popconfirm>
      </div>
    </Drawer>
  );
}
