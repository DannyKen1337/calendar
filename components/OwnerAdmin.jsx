"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ConfigProvider, Drawer, Popconfirm, Switch } from 'antd';
import {
  SyncOutlined, RightOutlined, LeftOutlined, MobileOutlined, UnorderedListOutlined, EditOutlined, CopyOutlined, LockOutlined,
  UnlockOutlined, DeleteOutlined, LinkOutlined, ShareAltOutlined, FormOutlined, SearchOutlined, CloseOutlined,
} from '@ant-design/icons';
import { tavernTheme, STORES, AdminModals, checkinPageUrl, registrationPageUrl, eventShareUrl } from '@/app/components';
import { getGameColor } from '@/lib/gameConfig';
import { eventMatchesQuery, eventExtraSearchText } from '@/lib/eventSearch';
import { rgnEventId } from '@/lib/rgn';
import { dayOccupancy, eventDay, STORE_IDS } from '@/lib/occupancy';
import OccupancyManager from '@/components/OccupancyManager';
import s from './OwnerAdmin.module.css';

// A tulajdonos (Admin2) admin felülete: egyszerű és gyors, telefonra (iPhone, Safari web app) és gépre.
// Fülek: Események (hónaponként, ez a kezdőoldal), Telítettség (napi telítettség, kézi helyfoglalás, a modul
// kapcsolója és a boltok férőhelye), Továbbiak (eszközök és fiók). Telefonon kártyák nagy gombokkal, gépen táblázat
// soronkénti műveletekkel; egy eseményre koppintva alulról felcsúszó lapon minden teendője.
// Az ablakok (szerkesztés, jelentkezők, ...) a szervezői nézettel közösek (AdminModals).

// Kezdőoldal: Események (a „Ma” fül a tulajdonos kérésére kikerült)
const TABS = [['esemenyek', 'Események'], ['telitettseg', 'Telítettség'], ['tovabbiak', 'Továbbiak']];
const TAB_STORAGE = 'tavern-owner-tab';
const MONTHS = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
const WEEKDAYS = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
const SHORT_STORES = { debrecen: 'Debrecen', miskolc: 'Miskolc', jatekceh: 'JátékCéh' };

const eid = (e) => String(e._id || e.id);
const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shiftKey = (key, n) => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate() + n); return keyOf(d); };
const timeOf = (e) => String(e.date || '').slice(11, 16);
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const dayTitle = (key, todayKey) => {
  const d = new Date(`${key}T12:00:00`);
  const label = `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}.`;
  return key === todayKey ? `Ma · ${label}` : key === shiftKey(todayKey, 1) ? `Holnap · ${label}` : cap(label);
};

// Létszám egy eseménynél: { text, full, counted }
function capacity(e) {
  if (e.isOpenAttendance) return { text: 'kötetlen', counted: false };
  if (e.external_url && !(rgnEventId(e.external_url) && e.rgn?.syncedAt)) return { text: 'külső', counted: false };
  const cur = e.current_players || 0;
  const max = e.external_url ? e.rgn?.capacity : e.max_players;
  return { text: max ? `${cur} / ${max}` : String(cur), full: !!max && cur >= max, counted: true };
}

export default function OwnerAdmin({ app, onShowChangelog, unseenCount }) {
  const [tab, setTab] = useState(() => {
    if (typeof window === 'undefined') return 'esemenyek';
    const saved = window.sessionStorage.getItem(TAB_STORAGE);
    return TABS.some(t => t[0] === saved) ? saved : 'esemenyek';
  });
  const [selected, setSelected] = useState(null); // a megnyitott esemény azonosítója (teendőlap)
  const [store, setStore] = useState('Mind');
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [updatedAt, setUpdatedAt] = useState(() => new Date());
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
    try { await app.fetchData(true); setUpdatedAt(new Date()); } finally { setRefreshing(false); }
  };

  const todayKey = keyOf(new Date());
  const occ = app.occupancy || { enabled: false, capacity: {} };
  const allEvents = (app.tournaments || [])
    .filter(e => store === 'Mind' || (e.store || 'debrecen') === store)
    .filter(e => eventMatchesQuery(e, query, `${eventExtraSearchText(e, STORES[e.store || 'debrecen']?.name)} ${app.hostNames(e).join(' ')}`))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const allBookings = (app.bookings || []).filter(b => store === 'Mind' || b.store === store);


  // Egy időszak sorai: események és kézi foglalások napokra bontva
  const rowsFor = (pred) => {
    const items = [
      ...allEvents.filter(e => pred(eventDay(e))).map(e => ({ kind: 'event', key: eventDay(e), sort: timeOf(e), e })),
      ...allBookings.filter(b => pred(b.date)).map(b => ({ kind: 'booking', key: b.date, sort: b.from, b })),
    ].sort((a, b) => a.key.localeCompare(b.key) || a.sort.localeCompare(b.sort));
    const groups = [];
    for (const it of items) {
      const last = groups[groups.length - 1];
      if (last && last.key === it.key) last.items.push(it); else groups.push({ key: it.key, items: [it] });
    }
    return groups;
  };

  const openNewEvent = () => {
    app.eventForm.resetFields();
    app.eventForm.setFieldsValue({ store: app.defaultStoreFor(store !== 'Mind' ? store : undefined) });
    app.setEditingEventId(null);
    app.setIsCopyingEvent(false);
    app.setIsExternalForm(false);
    app.setIsEventModalOpen(true);
  };
  const openAttendees = (e) => { app.setSelectedEventIdForAttendees(eid(e)); app.setIsAttendeesModalOpen(true); };
  const toggleGate = (e) => app.handleToggleGate(eid(e), !e.is_open);
  const bumpBooking = (b, d) => app.saveBooking({ id: b._id, store: b.store, date: b.date, label: b.label, from: b.from, to: b.to, seats: Math.max(1, b.seats + d) });
  const selectedEvent = selected ? (app.tournaments || []).find(e => eid(e) === selected) : null;

  // --- Részek ---

  const stateOf = (e) => {
    const c = capacity(e);
    if (e.isOpenAttendance) return { label: 'Nincs jelentkezés', tone: 'quiet' };
    if (e.external_url) return { label: 'Külső jelentkezés', tone: 'quiet' };
    if (!e.is_open) return { label: 'Lezárva', tone: 'red' };
    if (c.full) return { label: 'Betelt', tone: 'plain' };
    return { label: 'Nyitva', tone: 'plain' };
  };

  // Telefonon: egy esemény kártyája a három leggyakoribb teendővel
  const eventCard = (e) => {
    const c = capacity(e);
    const hasRegs = !e.external_url && !e.isOpenAttendance;
    const note = e.isOpenAttendance ? 'kötetlen létszám' : !e.is_open && hasRegs ? 'jelentkezés lezárva'
      : c.full ? `betelt${e.queue_count ? `, ${e.queue_count} vár` : ''}` : hasRegs ? `${Math.max(0, e.max_players - (e.current_players || 0))} hely szabad` : 'külső jelentkezés';
    return (
      <div key={eid(e)} className={s.card}>
        <button type="button" className={s.cardHead} onClick={() => setSelected(eid(e))}>
          <span className={s.cardTitle}><b className={s.num}>{timeOf(e)}</b> <b>{e.name}</b></span>
          <b className={s.num}>{c.text}</b>
        </button>
        <span className={s.cardSub}><i className={s.dot} style={{ background: getGameColor(e) }} aria-hidden="true" />{SHORT_STORES[e.store || 'debrecen']} · {note}</span>
        <div className={s.cardBtns}>
          {hasRegs ? (
            <>
              <Link className={s.bigBtn} href={checkinPageUrl(e)}>Check-in</Link>
              <button type="button" className={s.bigBtn} onClick={() => openAttendees(e)}>Jelentkezők</button>
              <button type="button" className={s.bigBtn} onClick={() => toggleGate(e)} disabled={app.togglingGateId === eid(e)}>{e.is_open ? 'Lezárás' : 'Megnyitás'}</button>
            </>
          ) : (
            <>
              <button type="button" className={s.bigBtn} onClick={() => app.openEditEvent(e)}>Szerkesztés</button>
              <button type="button" className={s.bigBtn} onClick={() => setSelected(eid(e))}>Teendők</button>
            </>
          )}
        </div>
      </div>
    );
  };

  const bookingCard = (b) => (
    <div key={b._id} className={s.card}>
      <span className={s.cardHead} style={{ cursor: 'default' }}>
        <span className={s.cardTitle}><b className={s.num}>{b.from}–{b.to}</b> <b>{b.label}</b></span>
        <b className={s.num}>{b.seats} hely</b>
      </span>
      <span className={s.cardSub}><i className={`${s.dot} ${s.dotBooking}`} aria-hidden="true" />{SHORT_STORES[b.store]} · kézi foglalás</span>
      <div className={s.cardBtns}>
        <button type="button" className={s.bigBtn} onClick={() => bumpBooking(b, -1)} disabled={b.seats <= 1}>−1 hely</button>
        <button type="button" className={s.bigBtn} onClick={() => bumpBooking(b, 1)}>+1 hely</button>
        <button type="button" className={s.bigBtn} onClick={() => goTab('telitettseg')}>Szerkesztés</button>
      </div>
    </div>
  );

  // Gépen: egy időszak táblázata napokra bontva
  const table = (groups, emptyText) => (
    <div className={s.tableBox}>
      <table className={s.table}>
        <thead>
          <tr><th style={{ width: 96 }}>Idő</th><th>Esemény / foglalás</th><th>Bolt</th><th className={s.right}>Létszám</th><th className={s.right}>Vár</th><th>Állapot</th><th className={s.right}>Műveletek</th></tr>
        </thead>
        <tbody>
          {groups.length === 0 && <tr><td colSpan={7} className={s.emptyCell}>{emptyText}</td></tr>}
          {groups.map(g => [
            <tr key={g.key} className={s.dayRow}><td colSpan={7} className={g.key === todayKey ? s.dayToday : undefined}>{dayTitle(g.key, todayKey)}</td></tr>,
            ...g.items.map(it => {
              if (it.kind === 'booking') {
                const b = it.b;
                return (
                  <tr key={`b${b._id}`} className={s.tr}>
                    <td className={s.num}><b>{b.from}–{b.to}</b></td>
                    <td><b>{b.label}</b> <span className={s.quiet}>· kézi foglalás</span></td>
                    <td className={s.quiet}>{STORES[b.store]?.name}</td>
                    <td className={`${s.right} ${s.num}`}><b>{b.seats} hely</b></td>
                    <td className={`${s.right} ${s.quiet}`}>—</td>
                    <td><span className={s.pill}>Foglalva</span></td>
                    <td className={s.right}>
                      <button type="button" className={s.act} onClick={() => bumpBooking(b, 1)}>Bővítés</button>
                      <button type="button" className={s.act} onClick={() => goTab('telitettseg')}>Szerkesztés</button>
                      <Popconfirm title="Törlöd ezt a foglalást?" okText="Törlés" cancelText="Mégse" okButtonProps={{ danger: true }} onConfirm={() => app.deleteBooking(b._id)}>
                        <button type="button" className={`${s.act} ${s.actDanger}`}>Törlés</button>
                      </Popconfirm>
                    </td>
                  </tr>
                );
              }
              const e = it.e;
              const c = capacity(e);
              const st = stateOf(e);
              const hasRegs = !e.external_url && !e.isOpenAttendance;
              return (
                <tr key={eid(e)} className={s.tr}>
                  <td className={s.num}><b>{timeOf(e)}</b></td>
                  <td><button type="button" className={s.linkCell} onClick={() => setSelected(eid(e))}><b>{e.name}</b></button> <span className={s.quiet}>· {e.category || 'Egyéb'}</span></td>
                  <td className={s.quiet}>{STORES[e.store || 'debrecen']?.name}</td>
                  <td className={`${s.right} ${s.num}`}><b>{c.text}</b></td>
                  <td className={`${s.right} ${s.num} ${s.quiet}`}>{e.queue_count > 0 ? e.queue_count : '—'}</td>
                  <td><span className={`${s.pill} ${st.tone === 'red' ? s.pillRed : st.tone === 'quiet' ? s.pillQuiet : ''}`}>{st.label}</span></td>
                  <td className={s.right}>
                    {hasRegs && <Link className={`${s.act} ${s.actStrong}`} href={checkinPageUrl(e)}>Check-in</Link>}
                    {hasRegs && <button type="button" className={s.act} onClick={() => openAttendees(e)}>Jelentkezők</button>}
                    {hasRegs && <button type="button" className={s.act} onClick={() => toggleGate(e)} disabled={app.togglingGateId === eid(e)}>{e.is_open ? 'Lezárás' : 'Megnyitás'}</button>}
                    <button type="button" className={s.act} onClick={() => app.openEditEvent(e)}>Szerkesztés</button>
                  </td>
                </tr>
              );
            }),
          ])}
        </tbody>
      </table>
    </div>
  );

  // Telefonon: napokra bontott kártyák
  const cards = (groups, emptyText) => (groups.length === 0 ? <p className={s.empty}>{emptyText}</p> : groups.map(g => (
    <section key={g.key} className={s.dayGroup}>
      <h3 className={`${s.dayHead} ${g.key === todayKey ? s.dayHeadToday : ''}`}>{dayTitle(g.key, todayKey)}</h3>
      {g.items.map(it => (it.kind === 'booking' ? bookingCard(it.b) : eventCard(it.e)))}
    </section>
  )));

  const listOf = (groups, emptyText) => (
    <>
      <div className={s.onPhone}>{cards(groups, emptyText)}</div>
      <div className={s.onDesk}>{table(groups, emptyText)}</div>
    </>
  );

  const storeChips = (
    <div className={s.chips} role="group" aria-label="Bolt">
      {['Mind', ...STORE_IDS].map(id => (
        <button key={id} type="button" className={s.chip} aria-pressed={store === id} onClick={() => setStore(id)}>{id === 'Mind' ? 'Minden bolt' : SHORT_STORES[id]}</button>
      ))}
    </div>
  );

  // A mai napi telítettség boltonként (a Telítettség fülre visz)
  const occupancyCard = () => {
    const rows = STORE_IDS.map(id => ({ id, o: dayOccupancy({ store: id, day: todayKey, tournaments: app.tournaments, bookings: app.bookings, capacity: occ.capacity }) }));
    const anyCap = rows.some(r => r.o.cap);
    return (
      <button type="button" className={s.occCard} onClick={() => goTab('telitettseg')}>
        <span className={s.occHead}><b>Napi telítettség · ma</b><span className={s.quiet}>Foglalás, beállítás ›</span></span>
        {!occ.enabled && <span className={s.hint}>A modul ki van kapcsolva: csak te látod.</span>}
        {anyCap ? rows.map(({ id, o }) => (
          <span key={id} className={s.occRow}>
            <span className={s.occName}>{SHORT_STORES[id]}</span>
            {o.cap ? (
              <>
                <span className={s.occBar} aria-hidden="true">
                  <span style={{ width: `${Math.min(100, (o.events / o.cap) * 100)}%`, background: o.over ? '#ef7b74' : '#e5b15d' }} />
                  <span style={{ width: `${Math.min(100 - Math.min(100, (o.events / o.cap) * 100), (o.manual / o.cap) * 100)}%`, background: '#d9cdc8' }} />
                </span>
                <b className={`${s.num} ${o.over ? s.red : ''}`} style={{ width: 64, textAlign: 'right' }}>{o.used}/{o.cap}</b>
              </>
            ) : <span className={s.quiet} style={{ flex: 1 }}>nincs férőhely megadva</span>}
          </span>
        )) : <span className={s.hint}>Állítsd be a boltok napi férőhelyét a Telítettség fülön.</span>}
      </button>
    );
  };

  // Események: hónaponként (keresésnél minden hónap)
  const eventsView = () => {
    const searching = query.trim() !== '';
    const mKey = `${month.getFullYear()}-${pad(month.getMonth() + 1)}`;
    const isCurrent = keyOf(month).slice(0, 7) === todayKey.slice(0, 7);
    const groups = rowsFor(key => searching || key.slice(0, 7) === mKey);
    const count = groups.reduce((n, g) => n + g.items.filter(i => i.kind === 'event').length, 0);
    return (
      <>
        <div className={s.titleRow}>
          <div>
            <h1 className={s.title}>Események</h1>
            <p className={s.sub}>{searching ? `${count} találat` : `${count} esemény · ${month.getFullYear()}. ${MONTHS[month.getMonth()]}`}</p>
          </div>
          <button type="button" className={s.primary} onClick={openNewEvent}>+ Új esemény</button>
        </div>
        {/* Gyors gombok (a Továbbiak fül leggyakoribb pontjai) */}
        <nav className={s.chips} aria-label="Gyors gombok">
          {[['Generátor', '/admin/generator'], ['Check-in', '/admin/checkin'], ['Előrendelés', '/admin/elorendeles'], ['Ligák', '/admin/liga'], ['Statisztika', '/admin/statisztika'], ['Felhasználók', '/admin/felhasznalok']].map(([label, href]) => (
            <Link key={href} href={href} className={s.chip} style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>{label}</Link>
          ))}
          <a href={`${process.env.NEXT_PUBLIC_WEBSITE_URL || '/weblapteszt'}/admin`} className={s.chip} style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Weboldal</a>
        </nav>
        {occupancyCard()}
        <label className={s.search}>
          <SearchOutlined />
          <input type="search" value={query} onChange={(ev) => setQuery(ev.target.value)} placeholder="Név, játék, szervező…" enterKeyHint="search" aria-label="Keresés" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Keresés törlése"><CloseOutlined /></button>}
        </label>
        {storeChips}
        {!searching && (
          <div className={s.pager}>
            <button type="button" className={s.round} onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} aria-label="Előző hónap"><LeftOutlined /></button>
            <b>{month.getFullYear()}. {MONTHS[month.getMonth()]}</b>
            {!isCurrent && <button type="button" className={s.linkBtn} onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Mostani hónap</button>}
            <button type="button" className={s.round} onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} aria-label="Következő hónap"><RightOutlined /></button>
          </div>
        )}
        {listOf(groups, searching ? 'Nincs találat.' : 'Ebben a hónapban nincs esemény.')}
      </>
    );
  };

  const linkRow = (label, hint, href, external) => (external
    ? <a className={s.tool} href={href}><span><b>{label}</b>{hint && <small>{hint}</small>}</span><RightOutlined className={s.chev} /></a>
    : <Link className={s.tool} href={href}><span><b>{label}</b>{hint && <small>{hint}</small>}</span><RightOutlined className={s.chev} /></Link>);
  const buttonRow = (label, hint, onClick, danger) => (
    <button type="button" className={`${s.tool} ${danger ? s.toolDanger : ''}`} onClick={onClick}><span><b>{label}</b>{hint && <small>{hint}</small>}</span><RightOutlined className={s.chev} /></button>
  );

  // Továbbiak: minden, ami nem egy eseményhez tartozik, és a fiók
  const moreView = () => (
    <>
      <h1 className={s.title}>Továbbiak</h1>
      <h2 className={s.groupTitle}>Események</h2>
      <div className={s.group}>
        {buttonRow('Új esemény', null, openNewEvent)}
        {linkRow('Generátor', 'Ismétlődő események egyszerre', '/admin/generator')}
        {linkRow('Check-in', null, '/admin/checkin')}
        {linkRow('Statisztika', null, '/admin/statisztika')}
        {linkRow('Nyilvános naptár', null, '/', true)}
      </div>
      <h2 className={s.groupTitle}>Modulok</h2>
      <div className={s.group}>
        {linkRow('Előrendelés', null, '/admin/elorendeles')}
        {linkRow('Ligák', null, '/admin/liga')}
        {linkRow('Weboldal', 'Hírek és az oldal tartalma', `${process.env.NEXT_PUBLIC_WEBSITE_URL || '/weblapteszt'}/admin`, true)}
      </div>
      <h2 className={s.groupTitle}>Tulajdonos</h2>
      <div className={s.group}>
        {linkRow('Felhasználók és csoportok', null, '/admin/felhasznalok')}
        {linkRow('Rendszer és napló', null, '/admin/rendszer')}
        {buttonRow('Feketelista', `${(app.blacklist || []).length} tiltott e-mail`, () => app.setIsBlacklistModalOpen(true))}
        <div className={s.tool}>
          <span><b>Karbantartás</b><small>{app.isMaintenance ? 'Bekapcsolva: nem lehet jelentkezni' : 'Kikapcsolva'}</small></span>
          <Popconfirm title={`Biztosan ${app.isMaintenance ? 'kikapcsolod' : 'bekapcsolod'} a karbantartást?`} onConfirm={() => app.toggleMaintenance(!app.isMaintenance)} okText="Igen" cancelText="Mégse">
            <Switch checked={!!app.isMaintenance} aria-label="Karbantartás" />
          </Popconfirm>
        </div>
      </div>
      <h2 className={s.groupTitle}>Adatok</h2>
      <div className={s.group}>
        {buttonRow('Teljes adatbázis mentés', 'JSON fájl letöltése', app.handleExportDB)}
        <Popconfirm title="Biztosan törlöd a 2 hónapnál régebbi eseményeket és jelentkezőiket?" onConfirm={app.handleCleanupOldEvents} okText="Törlés" cancelText="Mégse" okButtonProps={{ danger: true }}>
          {buttonRow('Régi események törlése', '2 hónapnál régebbiek, jelentkezőikkel', undefined, true)}
        </Popconfirm>
      </div>
      <h2 className={s.groupTitle}>Fiók · {app.userName}</h2>
      <div className={s.group}>
        <button type="button" className={s.tool} onClick={onShowChangelog}><span><b>Újdonságok</b></span>{unseenCount > 0 ? <span className={s.badge}>{unseenCount}</span> : <RightOutlined className={s.chev} />}</button>
        {buttonRow('Saját jelszó', null, () => { app.ownPasswordForm.resetFields(); app.setIsOwnPasswordModalOpen(true); })}
        {buttonRow('Kijelentkezés', null, () => app.handleLogout(), true)}
      </div>
      {!standalone && <p className={s.tip}>Tipp: telepítsd web appként. Safariban: Megosztás → Főképernyőhöz adás.</p>}
    </>
  );

  return (
    <ConfigProvider theme={tavernTheme}>
      {/* iPhone: a 16 px alatti beviteli mezőkbe koppintva a Safari ránagyít; az ablakokban (antd) is legyen 16 px */}
      <style>{'@media (pointer: coarse) { .ant-input, .ant-input-affix-wrapper input, .ant-select-selection-search-input, .ant-select-selection-item, .ant-picker input, textarea.ant-input { font-size: 16px !important; } }'}</style>
      <div className={s.shell}>
        <header className={s.topbar}>
          <b>Tavern Admin</b>
          <span className={`${s.quiet} ${s.num}`} style={{ marginLeft: 'auto' }}>Frissítve {updatedAt.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}</span>
          <button type="button" className={s.iconBtn} onClick={refresh} aria-label="Frissítés" disabled={refreshing}><SyncOutlined spin={refreshing} /></button>
        </header>

        <nav className={s.tabbar} aria-label="Admin">
          <b className={s.brand}>Tavern Admin</b>
          {TABS.map(([key, label]) => (
            <button key={key} type="button" className={s.tabBtn} aria-current={tab === key ? 'page' : undefined} onClick={() => goTab(key)}>
              {label}{key === 'tovabbiak' && unseenCount > 0 && <i className={s.tabDot} aria-label="Új újdonság" />}
            </button>
          ))}
          <span className={s.sideUser}>{app.userName} · tulajdonos</span>
        </nav>

        <main className={s.main}>
          {tab === 'esemenyek' && eventsView()}
          {tab === 'telitettseg' && (<><h1 className={s.title}>Napi telítettség</h1><OccupancyManager app={app} /></>)}
          {tab === 'tovabbiak' && moreView()}
        </main>
      </div>

      <EventSheet app={app} evt={selectedEvent} onClose={() => setSelected(null)} />
      <AdminModals app={app} />
    </ConfigProvider>
  );
}

// Egy esemény összes teendője alulról felcsúszó lapon
function EventSheet({ app, evt, onClose }) {
  const open = !!evt;
  const [last, setLast] = useState(evt);
  // Bezáráskor a lap még lecsúszik: addig az utolsó esemény maradjon rajta
  if (evt && evt !== last) setLast(evt);
  const e = evt || last;
  if (!e) return null;

  const id = eid(e);
  const c = capacity(e);
  const hasRegs = !e.external_url && !e.isOpenAttendance;
  const isRgn = !!rgnEventId(e.external_url);
  const closed = !e.is_open;
  const run = (fn) => () => { onClose(); fn(); };
  const d = new Date(`${eventDay(e)}T12:00:00`);

  const share = async () => {
    const url = eventShareUrl(e);
    try {
      if (navigator.share) await navigator.share({ title: e.name, url });
      else { await navigator.clipboard.writeText(url); app.messageApi?.success('Link kimásolva.'); }
    } catch { /* a megosztás bezárása nem hiba */ }
  };

  const action = (key, icon, label, props) => {
    const { href, onClick, external } = props;
    if (href) return external
      ? <a key={key} className={s.action} href={href} target="_blank" rel="noopener noreferrer">{icon}<span>{label}</span></a>
      : <Link key={key} className={s.action} href={href}>{icon}<span>{label}</span></Link>;
    return <button key={key} type="button" className={s.action} onClick={onClick}>{icon}<span>{label}</span></button>;
  };

  return (
    <Drawer open={open} onClose={onClose} placement="bottom" size="auto" title={null} closable={false} rootClassName={s.sheetRoot}>
      <div className={s.sheetBody}>
        <span className={s.grabber} aria-hidden="true" />
        <div className={s.sheetHead}>
          <p className={s.sheetWhen}>{cap(`${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}.`)} · {timeOf(e)}</p>
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
          {hasRegs && action('checkin', <MobileOutlined />, 'Check-in', { href: checkinPageUrl(e) })}
          {hasRegs && action('regs', <UnorderedListOutlined />, 'Jelentkezők', { onClick: run(() => { app.setSelectedEventIdForAttendees(id); app.setIsAttendeesModalOpen(true); }) })}
          {isRgn && action('rgn', <UnorderedListOutlined />, 'Riftbound jelentkezők', { onClick: run(() => app.setSelectedRgnEventId(id)) })}
          {action('edit', <EditOutlined />, 'Szerkesztés', { onClick: run(() => app.openEditEvent(e)) })}
          {hasRegs && action('gate', closed ? <UnlockOutlined /> : <LockOutlined />, app.togglingGateId === id ? 'Folyamatban…' : closed ? 'Megnyitás' : 'Lezárás', { onClick: () => app.handleToggleGate(id, closed) })}
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
