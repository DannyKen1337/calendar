"use client";

import { useState } from 'react';
import { Grid, ConfigProvider, Drawer } from 'antd';
import { SearchOutlined, CloseCircleFilled, CloseOutlined, DownOutlined } from '@ant-design/icons';
import { useCalendar } from '@/app/useCalendar';
import { CalendarView, SearchResults, EventList, PublicModals, STORES, tavernTheme } from '@/app/components';
import MonthCalendar from '@/components/MonthCalendar';
import WeekCalendar from '@/components/WeekCalendar';
import { eventMatchesQuery } from '@/lib/eventSearch';
import { isSpecialEvent, getEventTypeConfig } from '@/lib/eventTypes';
import { GAME_CONFIG, getGameColor } from '@/lib/gameConfig';
import { STORE_HOURS } from '@/lib/storeHours';
import { dayOccupancy, eventDay } from '@/lib/occupancy';
import EmbedBridge from '@/components/EmbedBridge';
import s from './PublicCalendar.module.css';

// Ugyanabban a városban lévő boltok: játékszűrésnél egymás minden eseménye látszik (halványan)
const LINKED_STORES = { debrecen: ['jatekceh'], jatekceh: ['debrecen'] };
const VIEW_KEY = 'tavern-naptar-nezet';
const VIEWS = [['month', 'Havi'], ['week', 'Heti'], ['list', 'Lista']];
const SHORT_STORES = { debrecen: 'Debrecen', miskolc: 'Miskolc', jatekceh: 'JátékCéh' };
const pad = (n) => String(n).padStart(2, '0');
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

// A nyilvános naptár. A bolt kiválasztása után: fejléc, boltváltó (a mai napi telítettséggel, ha nyilvános), kereső,
// játékszűrő, nézetváltó (Havi – alapból –, Heti, Lista), alatta a mai program.
// embed: iframe-be ágyazott nézet (pl. webshopba) – kompakt, nincs teljes képernyős magasság.
// fixedStore: a beágyazó által rögzített helyszín (?store=...), ilyenkor nincs boltválasztó.
export default function PublicCalendar({ embed = false, fixedStore = null }) {
  const app = useCalendar();
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;
  const [activeFilters, setActiveFilters] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [view, setView] = useState(() => {
    if (typeof window === 'undefined') return 'month';
    const saved = window.localStorage.getItem(VIEW_KEY);
    return VIEWS.some(v => v[0] === saved) ? saved : 'month';
  });
  const pickView = (v) => { setView(v); try { window.localStorage.setItem(VIEW_KEY, v); } catch { /* privát mód */ } };

  if (app.loading && embed) {
    return <div className={`${s.page} ${s.embed}`} style={{ display: 'grid', placeItems: 'center', padding: '64px 0', color: '#e5b15d', fontWeight: 700 }}><EmbedBridge />Betöltés...</div>;
  }
  // Betöltés közben a hónap váza, hogy az oldal ne ugráljon, amikor megjön az adat
  if (app.loading) {
    return (
      <main className={`${s.page} ${s.v2}`} aria-busy="true">
        <div className={s.wrap}>
          <span className={s.srOnly} role="status">Betöltés…</span>
          <span className={`${s.skel} ${s.skelTitle}`} data-vaz />
          <span className={`${s.skel} ${s.skelBar}`} data-vaz />
          <span className={`${s.skel} ${s.skelBar}`} data-vaz />
          <div className={s.mobileGrid} aria-hidden="true">
            {Array.from({ length: 35 }, (_, i) => <span key={i} className={`${s.skel} ${s.skelCell}`} data-vaz />)}
          </div>
        </div>
      </main>
    );
  }

  const isStaff = app.userRole === 'admin' || app.userRole === 'owner';
  // Az új kinézet (nagyobb gombok, kompakt eszközsor telefonon, játékszűrő alsó lapon, ugrás a következő eseményre):
  // mindenkinek; a beágyazott (webshopba tett) kompakt nézet marad a régi
  const fresh = !embed;

  // Karbantartás: látogatók elől rejtve, bejelentkezett adminok látják a naptárt
  if (app.isMaintenance && !isStaff) {
    return (
      <main className={`${s.page} ${embed ? s.embed : ''}`} style={{ display: 'grid', placeItems: 'center', padding: 16 }}>
        {embed && <EmbedBridge />}
        <div style={{ maxWidth: 520, padding: 32, borderRadius: 16, background: '#191314', textAlign: 'center' }}>
          <h1 className={s.title} style={{ marginBottom: 12 }}>Karbantartás alatt</h1>
          <p style={{ margin: 0, color: '#b8aca7' }}>A Tavern rendszerei jelenleg fejlesztés és karbantartás alatt állnak. Kérjük, látogass vissza később!</p>
        </div>
      </main>
    );
  }

  // Napi telítettség (csak ha a tulajdonos a nyilvános naptárban is bekapcsolta)
  const occ = app.publicOccupancy;
  const occToday = (id) => (occ?.capacity?.[id]
    ? dayOccupancy({ store: id, day: todayKey(), tournaments: app.tournaments, bookedSeats: occ.booked?.[`${id}|${todayKey()}`] || 0, capacity: occ.capacity })
    : null);
  const now = new Date();
  const hoursLabel = (id) => { const h = STORE_HOURS[id]?.[now.getDay()]; return h === undefined ? '' : h ? `ma ${h[0]}–${h[1]}` : 'ma zárva'; };

  // Kezdőképernyő: boltválasztó (ismeretlen, pl. régi localStorage-ban maradt azonosítót figyelmen kívül hagyunk)
  const selectedStore = [fixedStore, app.selectedStore].find(id => id && STORES[id]) || null;
  if (!selectedStore) {
    return (
      <main className={`${s.page} ${embed ? s.embed : ''}`}>
        {embed && <EmbedBridge />}
        <div className={s.wrap} style={{ maxWidth: 980, paddingTop: embed ? 20 : 'max(48px, 10vh)' }}>
          <header className={s.head}>
            <h1 className={s.title}>Tavern eseménynaptár</h1>
            <p className={s.sub}>Válaszd ki, melyik bolt eseményeire vagy kíváncsi.</p>
          </header>
          <div className={s.pickStores}>
            {Object.values(STORES).map(st => {
              const o = occToday(st.id);
              return (
                <button key={st.id} type="button" className={s.pickStore} onClick={() => app.handleSelectStore(st.id)}>
                  <span className={s.pickName}>{st.name}</span>
                  <span className={s.sub}>{hoursLabel(st.id)}{o ? ` · ${o.used} / ${o.cap} hely foglalt` : ''}</span>
                  <span className={s.pickGo}>Megnyitom ›</span>
                </button>
              );
            })}
          </div>
        </div>
      </main>
    );
  }

  // A kiválasztott bolt eseményei (a bolt nélküli régi események Debrecenhez tartoznak)
  const storeTournaments = app.tournaments.filter(e => (e.store || 'debrecen') === selectedStore);
  // Játékszűrésnél a másik bolt eseményei is megjelennek halványan: Tavern Debrecen és JátékCéh között minden esemény
  // (egy városban vannak), a többi bolt között csak a kiemelt és a különleges események
  const otherStoreEvents = activeFilters.length === 0 ? [] : app.tournaments
    .filter(e => (e.store || 'debrecen') !== selectedStore && activeFilters.includes(e.category))
    .filter(e => LINKED_STORES[selectedStore]?.includes(e.store || 'debrecen') || e.isFeatured || isSpecialEvent(e))
    .map(e => ({ ...e, _otherStore: e.store || 'debrecen' }));
  const finalTournaments = activeFilters.length === 0
    ? storeTournaments
    : [...storeTournaments.filter(e => activeFilters.includes(e.category)), ...otherStoreEvents];

  const trimmedQuery = searchQuery.trim();
  const isSearching = trimmedQuery.length > 0;
  const searchResults = isSearching ? finalTournaments.filter(e => eventMatchesQuery(e, trimmedQuery)) : finalTournaments;
  const appWithFilteredEvents = { ...app, selectedStore, tournaments: searchResults };

  const currentStore = STORES[selectedStore];
  const hoursText = hoursLabel(selectedStore) ? ` · ${hoursLabel(selectedStore)}` : '';

  const toggleFilter = (game) => setActiveFilters(f => (f.includes(game) ? f.filter(g => g !== game) : [...f, game]));
  // Naptárba mentés (ICS): a kiválasztott bolt (és a kijelölt játékok) eseményei fájlként
  const icsParams = new URLSearchParams({ store: selectedStore, ...(activeFilters.length > 0 ? { categories: activeFilters.join(',') } : {}) });

  const todays = storeTournaments.filter(e => eventDay(e) === todayKey()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const todayOcc = occToday(selectedStore);
  const openEvent = (evt) => { app.setSelectedEventDetails(evt); app.setIsEventDetailsModalOpen(true); };
  const upcoming = searchResults.filter(e => eventDay(e) >= todayKey()).sort((a, b) => String(a.date).localeCompare(String(b.date)));

  // Telefonon a havi nézet alatt már ott a kiválasztott nap (alapból ma), ezért ott nem kell külön mai program
  // (a heti nézetben, az új kinézetben, a mai nap a héten belül látszik)
  const showToday = !isSearching && !(isMobile && view === 'month') && !(fresh && view === 'week');

  // Az ablakok (esemény részletei, jelentkezés) és a listák a sötét Tavern témát kapják
  return (
    <ConfigProvider theme={tavernTheme}>
    <main className={`${s.page} ${embed ? s.embed : ''} ${fresh ? s.v2 : ''}`} data-uj-naptar={fresh ? '' : undefined}>
      {embed && <EmbedBridge />}
      {app.contextHolder}
      <div className={s.wrap}>
        {app.isMaintenance && isStaff && (
          <p className={s.notice}>Karbantartás mód be van kapcsolva — a nyilvános látogatók nem látják a naptárt, te igen (admin előnézet).</p>
        )}

        <header className={s.head}>
          <h1 className={s.title}>{currentStore?.name}</h1>
          <p className={s.sub}>Eseménynaptár{hoursText}</p>
        </header>

        {!fixedStore && (
          <div className={s.stores} role="group" aria-label="Helyszín">
            {Object.values(STORES).map(st => {
              const o = occToday(st.id);
              const on = st.id === selectedStore;
              return (
                <button key={st.id} type="button" aria-pressed={on} className={`${s.store} ${on ? s.storeOn : ''}`}
                  onClick={() => { if (!on) { setSearchQuery(''); app.handleSelectStore(st.id); } }}>
                  <span className={s.storeTop}>
                    <span className={s.storeName}>{fresh && isMobile ? SHORT_STORES[st.id] : st.name}</span>
                    {o && <span className={`${s.storeMeta} ${s.num}`}>ma {o.used} / {o.cap} hely</span>}
                  </span>
                  {o && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`${s.meter} ${o.over ? s.meterOver : ''}`} style={{ flex: 1 }} aria-hidden="true"><span style={{ width: `${Math.min(100, o.pct)}%` }} /></span>
                      <span className={s.num} style={{ fontSize: 13, fontWeight: 700 }}>{o.pct}%</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {fresh && isMobile ? (
          <>
            {searchOpen || isSearching ? (
              <div className={s.tools}>
                <label className={s.search}>
                  <SearchOutlined />
                  <input autoFocus type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { setSearchQuery(''); setSearchOpen(false); } }}
                    placeholder="Keresés…" aria-label="Keresés az események között" enterKeyHint="search" />
                </label>
                <button type="button" className={s.iconBtn} onClick={() => { setSearchQuery(''); setSearchOpen(false); }} aria-label="Keresés bezárása"><CloseOutlined /></button>
              </div>
            ) : (
              <div className={s.tools}>
                <div className={s.segment} role="group" aria-label="Nézet">
                  {VIEWS.map(([key, label]) => <button key={key} type="button" aria-pressed={view === key} onClick={() => pickView(key)}>{label}</button>)}
                </div>
                <button type="button" className={s.iconBtn} onClick={() => setSearchOpen(true)} aria-label="Keresés"><SearchOutlined /></button>
              </div>
            )}
            {isSearching && <p className={s.resultCount}>{searchResults.length} találat</p>}
            <button type="button" className={s.gamesBtn} aria-haspopup="dialog" onClick={() => setGamesOpen(true)}>
              {activeFilters.length === 0 ? <span>Játékok · mind</span> : <span>Játékok · {activeFilters.length}</span>}
              <span className={s.gamesDots} aria-hidden="true">{activeFilters.slice(0, 5).map(g => <i key={g} style={{ background: GAME_CONFIG[g]?.color }} />)}</span>
              <DownOutlined aria-hidden="true" />
            </button>
            <Drawer open={gamesOpen} onClose={() => setGamesOpen(false)} placement="bottom" size="auto" title={null} closable={false} rootClassName={s.sheetRoot}>
              <div className={s.sheet} role="group" aria-label="Játékok">
                <div className={s.sheetHead}>
                  <b>Játékok</b>
                  <button type="button" className={s.linkBtn} onClick={() => setActiveFilters([])}>Minden játék</button>
                </div>
                {Object.keys(GAME_CONFIG).filter(g => g !== 'Egyéb').map(game => (
                  <label key={game} className={s.sheetRow}>
                    <span className={s.chipDot} style={{ background: GAME_CONFIG[game].color }} aria-hidden="true" />
                    <span style={{ flex: 1 }}>{game}</span>
                    <input type="checkbox" checked={activeFilters.includes(game)} onChange={() => toggleFilter(game)} />
                  </label>
                ))}
                <a className={s.sheetLink} href={`/api/export?${icsParams.toString()}`}>Naptárba mentés (ICS)</a>
                <button type="button" className={s.sheetDone} onClick={() => setGamesOpen(false)}>Kész</button>
              </div>
            </Drawer>
          </>
        ) : (
          <>
        <div className={s.tools}>
            <label className={s.search}>
              <SearchOutlined />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setSearchQuery(''); }}
                placeholder={`Keresés a(z) ${currentStore?.name || ''} eseményei között`} aria-label="Keresés az események között" />
              {searchQuery && <button type="button" onClick={() => setSearchQuery('')} aria-label="Keresés törlése"><CloseCircleFilled /></button>}
            </label>
            {!isSearching && (
              <div className={s.segment} role="group" aria-label="Nézet">
                {VIEWS.map(([key, label]) => <button key={key} type="button" aria-pressed={view === key} onClick={() => pickView(key)}>{label}</button>)}
              </div>
            )}
          </div>
          {isSearching && <p className={s.resultCount}>{searchResults.length} találat</p>}
  
          <div className={s.chips} role="group" aria-label="Játék">
            <button type="button" className={s.chip} aria-pressed={activeFilters.length === 0} onClick={() => setActiveFilters([])}>Minden játék</button>
            {Object.keys(GAME_CONFIG).filter(g => g !== 'Egyéb').map(game => (
              <button key={game} type="button" className={s.chip} aria-pressed={activeFilters.includes(game)} onClick={() => toggleFilter(game)}>
                <span className={s.chipDot} style={{ background: GAME_CONFIG[game].color }} aria-hidden="true" />{game}
              </button>
            ))}
            {!embed && <a className={s.ics} href={`/api/export?${icsParams.toString()}`} style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Naptárba mentés (ICS)</a>}
          </div>
  
          </>
        )}
        {isSearching ? (
          <SearchResults app={appWithFilteredEvents} query={trimmedQuery} />
        ) : view === 'week' ? (
          fresh ? (
            <>
              <WeekCalendar app={appWithFilteredEvents} store={selectedStore} />
              <PublicModals app={appWithFilteredEvents} />
            </>
          ) : <CalendarView app={appWithFilteredEvents} compact={embed} weekly />
        ) : view === 'list' ? (
          <>
            {upcoming.length ? <EventList tournamentsData={upcoming} app={appWithFilteredEvents} /> : <p className={s.empty}>Nincs közelgő esemény.</p>}
            <PublicModals app={appWithFilteredEvents} />
          </>
        ) : (
          <>
            <MonthCalendar app={appWithFilteredEvents} store={selectedStore} storeEvents={storeTournaments} occupancy={occ} compact={embed} fresh={fresh} />
            <PublicModals app={appWithFilteredEvents} />
          </>
        )}

        {/* A mai program a bolt összes mai eseményét mutatja, a játékszűrőtől és a kereséstől függetlenül */}
        {showToday && (
          <section className={s.today} aria-labelledby="mai-program">
            <div className={s.todayHead}>
              <h2 id="mai-program" className={s.todayTitle}>Mai program</h2>
              <span className={`${s.todayMeta} ${s.num}`}>
                {now.toLocaleDateString('hu-HU', { month: 'long', day: 'numeric', weekday: 'long' })}
                {todayOcc ? ` · ${todayOcc.used} / ${todayOcc.cap} hely foglalt` : ''}
              </span>
            </div>
            {todays.length === 0 ? (
              <p className={s.empty}>Mára nincs kiírt esemény.</p>
            ) : (
              <ul className={s.list}>
                {todays.map(e => {
                  const special = isSpecialEvent(e) ? getEventTypeConfig(e) : null;
                  const counted = !e.isOpenAttendance && !e.external_url;
                  return (
                    <li key={String(e._id || e.id)}>
                      <button type="button" className={s.row} onClick={() => openEvent(e)}>
                        <span className={s.rowDot} style={{ background: special ? special.color : getGameColor(e) }} aria-hidden="true" />
                        <span className={s.rowMain}>
                          <span className={s.rowTop}><span className={s.rowTime}>{String(e.date).slice(11, 16)}</span><span className={s.rowName}>{special ? `${special.icon} ` : e.isFeatured ? '★ ' : ''}{e.name}</span></span>
                          <span className={s.rowSub}>{special ? `${special.label} · ` : ''}{e.category || 'Egyéb'}{e.isOpenAttendance ? ' · kötetlen létszám' : ''}</span>
                        </span>
                        {counted && <span className={s.rowCount}>{e.current_players} / {e.max_players}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

      </div>
    </main>
    </ConfigProvider>
  );
}
