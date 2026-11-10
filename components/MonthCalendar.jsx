"use client";
import { useState } from 'react';
import { Grid, Modal, ConfigProvider } from 'antd';
import { LeftOutlined, RightOutlined, CloseOutlined } from '@ant-design/icons';
import { tavernTheme, STORES } from '@/app/components';
import { getGameColor } from '@/lib/gameConfig';
import { isSpecialEvent, getEventTypeConfig } from '@/lib/eventTypes';
import { STORE_HOURS } from '@/lib/storeHours';
import { dayOccupancy, eventDay } from '@/lib/occupancy';
import s from './PublicCalendar.module.css';

// A nyilvános naptár havi nézete (a régi havi rács, új kinézettel). Gépen hétfőtől vasárnapig tartó rács, naponta legfeljebb
// 3 játékszínű csík (zsúfolt napon 2 és "+N további"), a különleges események előre kerülnek. Telefonon kompakt rács,
// alatta a kiválasztott nap eseményei. Ha a tulajdonos a nyilvános naptárban is bekapcsolta a napi telítettséget,
// minden nap alján a bolt napi telítettsége látszik.
// app: a szűrt eseményekkel; store: a kiválasztott bolt; storeEvents: a bolt összes eseménye (a telítettséghez, szűrés nélkül);
// occupancy: { capacity, booked } a nyilvános adatból, vagy null; compact: beágyazott nézet
// fresh: az új kinézet (egyelőre csak a tulajdonosnak): a napok felirata a játékokat is megnevezi, nyilakkal lehet lépni
// a napok között, üres napon gomb visz a következő eseményre, az eseménysoron telítettségsáv

const MONTHS = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'];
const WEEKDAYS = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat', 'Vasárnap'];
const WD_SHORT = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'];
const DAY_NAMES = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
const SHORT = { 'Pokémon TCG': 'Pokémon', 'One Piece Card Game': 'One Piece', 'Magic: The Gathering': 'Magic', 'Disney Lorcana': 'Lorcana', 'Flesh and Blood': 'FaB', 'CyberPunk TCG': 'CyberPunk' };
const MAX_STRIPS = 3;

const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeOf = (evt) => String(evt.date || '').slice(11, 16);
// Sötét betű a világos játékszíneken (sárga, türkiz, narancs), világos a sötéteken
const inkOn = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.6 ? '#160f0b' : '#ffffff';
};
const hasCount = (e) => !e.isOpenAttendance && (!e.external_url || e.rgn?.syncedAt);
const countText = (e) => (e.rgn?.syncedAt && e.external_url ? `${e.current_players || 0}${e.rgn.capacity ? `/${e.rgn.capacity}` : ''}` : `${e.current_players || 0}/${e.max_players}`);

// Egy nap eseményeinek sorai (a havi nézet napja és a heti nézet közös része): idő, név, játék, szabad helyek;
// az új kinézetben (fresh) telítettségsáv is. A sorok <li> elemek, egy <ul className={s.list}>-be kerülnek.
export function EventRows({ events, onOpen, fresh = false }) {
  return events.map(e => (
    <li key={String(e._id || e.id)} data-ujsor={fresh ? '' : undefined}>
      <button type="button" className={`${s.row} ${isSpecialEvent(e) ? 'special-row' : ''}`} style={isSpecialEvent(e) ? { '--special-color': getEventTypeConfig(e).color } : undefined}
        title={isSpecialEvent(e) ? getEventTypeConfig(e).label : undefined} onClick={() => onOpen(e)}>
        <span className={s.rowDot} style={{ background: isSpecialEvent(e) ? getEventTypeConfig(e).color : getGameColor(e) }} aria-hidden="true" />
        <span className={s.rowMain}>
          <span className={s.rowTop}><span className={s.rowTime}>{timeOf(e)}</span><span className={s.rowName}>{e.name}</span></span>
          <span className={s.rowSub}>
            {e.category || 'Egyéb'}{e._otherStore ? ` · ${STORES[e._otherStore]?.name}` : ''}
            {e.isOpenAttendance ? ' · kötetlen létszám' : hasCount(e) && !e.external_url ? ` · ${Math.max(0, e.max_players - (e.current_players || 0))} hely szabad` : ''}
          </span>
          {fresh && hasCount(e) && !e.external_url && e.max_players > 0 && (
            <span className={`${s.meter} ${s.rowMeter}`} data-sav aria-hidden="true"><span style={{ width: `${Math.min(100, ((e.current_players || 0) / e.max_players) * 100)}%` }} /></span>
          )}
        </span>
        {hasCount(e) && <span className={s.rowCount}>{countText(e)}</span>}
      </button>
    </li>
  ));
}

export default function MonthCalendar({ app, store, storeEvents, occupancy, compact = false, fresh = false }) {
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;
  const [today] = useState(() => new Date());
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(() => keyOf(today)); // telefonon a kiválasztott nap
  const [dayModal, setDayModal] = useState(null); // gépen a nap eseményeinek ablaka

  const todayKey = keyOf(today);
  const byDay = new Map();
  for (const e of app.tournaments || []) {
    const k = eventDay(e);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(e);
  }
  for (const list of byDay.values()) list.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  // Elfogadott asztalfoglalások: csak az időpont, név nélkül
  const tablesOn = (key) => (app.publicTableBookings || []).filter(b => b.store === store && b.date === key);

  const occFor = (key) => {
    if (!occupancy?.capacity?.[store]) return null;
    return dayOccupancy({ store, day: key, tournaments: storeEvents, bookedSeats: occupancy.booked?.[`${store}|${key}`] || 0, capacity: occupancy.capacity });
  };
  const isClosed = (date) => STORE_HOURS[store]?.[date.getDay()] === null;
  const open = (evt) => { setDayModal(null); app.setSelectedEventDetails(evt); app.setIsEventDetailsModalOpen(true); };
  // A nap felirata felolvasóknak: hány esemény, milyen játékokból
  const dayLabel = (d, evs, key, o) => {
    const games = [...new Set(evs.map(e => e.category || 'Egyéb'))].join(', ');
    return `${MONTHS[d.getMonth()]} ${d.getDate()}.: ${evs.length ? `${evs.length} esemény${fresh && games ? ` (${games})` : ''}` : '0 esemény'}${tablesOn(key).length ? `, ${tablesOn(key).length} foglalás` : ''}${o ? `, ${o.used} / ${o.cap} hely foglalt` : ''}`;
  };
  // Nyilak a napok között (balra-jobbra egy nap, fel-le egy hét); a hónap szélén nem lapoz
  const arrowKeys = (ev) => {
    const key = ev.target?.dataset?.day;
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[ev.key];
    if (!fresh || !key || !step) return;
    const d = new Date(`${key}T12:00:00`);
    d.setDate(d.getDate() + step);
    const target = ev.currentTarget.querySelector(`[data-day="${keyOf(d)}"]`);
    if (target) { ev.preventDefault(); target.focus(); }
  };
  // A legközelebbi eseményes nap a megadott nap után (a szűrt eseményekből)
  const nextDayAfter = (key) => [...byDay.keys()].filter(k => k > key).sort()[0] || null;
  const goDay = (key) => {
    const d = new Date(`${key}T12:00:00`);
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    if (isMobile) setSelected(key); else setDayModal(key);
  };

  const lead = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: daysIn }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1));
  const isCurrentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();
  const goMonth = (delta) => {
    const next = new Date(month.getFullYear(), month.getMonth() + delta, 1);
    setMonth(next);
    setSelected(keyOf(next.getFullYear() === today.getFullYear() && next.getMonth() === today.getMonth() ? today : next));
  };

  const strip = (e, past) => {
    const special = isSpecialEvent(e) ? getEventTypeConfig(e) : null;
    const color = special ? special.color : getGameColor(e);
    const other = e._otherStore ? STORES[e._otherStore]?.name : null;
    // A különleges eseményt (megjelenés, expo) a világító keret és a színátmenet jelzi, nem felirat (globals.css: special-strip)
    const label = `${!special && e.isFeatured ? '★ ' : ''}${timeOf(e)} ${SHORT[e.category] || e.category || 'Egyéb'}`;
    return (
      <button key={String(e._id || e.id)} type="button" className={`${s.strip} ${past ? s.stripPast : ''} ${other ? s.stripOther : ''} ${special ? 'special-strip' : ''}`}
        style={special ? { background: special.gradient, color: '#ffffff', '--special-color': special.color } : { background: color, color: inkOn(color) }}
        title={`${special ? `${special.label}: ` : ''}${timeOf(e)} ${e.name}${other ? ` (${other})` : ''}${hasCount(e) ? ` · ${countText(e)} jelentkező` : ''}`}
        onClick={(ev) => { ev.stopPropagation(); open(e); }}>
        <span className={s.stripText}>{label}</span>
        {hasCount(e) && <span className={s.stripCount}>{countText(e)}</span>}
      </button>
    );
  };

  const fillBar = (o) => o && o.used > 0 && (
    <span className={s.fill} title={`Napi telítettség: ${o.used} / ${o.cap} hely`}>
      <span className={`${s.meter} ${o.over ? s.meterOver : ''}`} aria-hidden="true"><span style={{ width: `${Math.min(100, o.pct)}%` }} /></span>
      <span className={`${s.fillText} ${o.over ? s.fillOver : ''}`}>{o.used}/{o.cap}</span>
    </span>
  );

  // Egy nap eseményei listában (telefonon a rács alatt, gépen az ablakban)
  const dayList = (key) => {
    const list = byDay.get(key) || [];
    const o = occFor(key);
    const date = new Date(`${key}T12:00:00`);
    const booked = o ? o.manual : 0;
    return (
      <>
        {o && (
          <div className={s.daySummary}>
            <span className={`${s.meter} ${o.over ? s.meterOver : ''}`} aria-hidden="true"><span style={{ width: `${Math.min(100, o.pct)}%` }} /></span>
            <span className={s.num}><b>{o.used} / {o.cap}</b> <span style={{ color: '#b8aca7' }}>hely · {o.free} szabad</span></span>
          </div>
        )}
        {list.length === 0 && !booked && tablesOn(key).length === 0 ? (
          <>
            <p className={s.empty}>{isClosed(date) ? 'A bolt ezen a napon zárva van.' : 'Nincs kiírt esemény ezen a napon.'}</p>
            {fresh && nextDayAfter(key) && (() => {
              const nk = nextDayAfter(key);
              const nd = new Date(`${nk}T12:00:00`);
              const first = byDay.get(nk)[0];
              return (
                <button type="button" className={s.nextBtn} data-kovetkezo onClick={() => goDay(nk)}>
                  <span>Következő esemény</span>
                  <b>{DAY_NAMES[nd.getDay()].replace(/^./, c => c.toUpperCase())}, {MONTHS[nd.getMonth()].toLowerCase()} {nd.getDate()}. · {timeOf(first)} ›</b>
                </button>
              );
            })()}
          </>
        ) : (
          <ul className={s.list}>
            <EventRows events={list} onOpen={open} fresh={fresh} />
            {tablesOn(key).map(b => (
              <li key={`${b.from}-${b.to}`}>
                <div className={s.row} style={{ cursor: 'default' }}>
                  <span className={`${s.rowDot} ${s.rowBooking}`} aria-hidden="true" />
                  <span className={s.rowMain}>
                    <span className={s.rowTop}><span className={s.rowTime}>{b.from}–{b.to}</span><span className={s.rowName}>Foglalás</span></span>
                  </span>
                </div>
              </li>
            ))}
            {booked > 0 && (
              <li>
                <div className={s.row} style={{ cursor: 'default' }}>
                  <span className={`${s.rowDot} ${s.rowBooking}`} aria-hidden="true" />
                  <span className={s.rowMain}><span className={s.rowName}>Asztalfoglalás</span><span className={s.rowSub}>A bolt foglalta le</span></span>
                  <span className={s.rowCount}>{booked} hely</span>
                </div>
              </li>
            )}
          </ul>
        )}
      </>
    );
  };

  const monthBar = (
    <div className={s.monthBar}>
      <div className={s.monthNav}>
        <button type="button" className={s.round} onClick={() => goMonth(-1)} aria-label="Előző hónap"><LeftOutlined /></button>
        <h2 className={s.monthTitle}>{MONTHS[month.getMonth()]} {month.getFullYear()}</h2>
        <button type="button" className={s.round} onClick={() => goMonth(1)} aria-label="Következő hónap"><RightOutlined /></button>
      </div>
      {!isCurrentMonth && <button type="button" className={s.todayBtn} onClick={() => goMonth((today.getFullYear() - month.getFullYear()) * 12 + today.getMonth() - month.getMonth())}>Aktuális hónap</button>}
    </div>
  );

  if (isMobile) {
    const selDate = new Date(`${selected}T12:00:00`);
    return (
      <div className={compact ? s.compact : undefined} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {monthBar}
        <div className={s.mobileGrid} onKeyDown={arrowKeys}>
          {WD_SHORT.map(w => <span key={w} className={s.mWd}>{w}</span>)}
          {Array.from({ length: lead }, (_, i) => <span key={`e${i}`} />)}
          {days.map(d => {
            const key = keyOf(d);
            const evs = byDay.get(key) || [];
            const o = occFor(key);
            const past = key < todayKey;
            return (
              <button key={key} type="button" aria-pressed={selected === key} data-day={fresh ? key : undefined}
                aria-label={dayLabel(d, evs, key, o)}
                className={`${s.mCell} ${past ? s.mCellPast : ''} ${key === todayKey ? s.mCellToday : ''} ${selected === key ? s.mCellSel : ''}`}
                onClick={() => setSelected(key)}>
                <span className={s.mNum}>{d.getDate()}</span>
                <span className={s.mDots} aria-hidden="true">{evs.slice(0, 3).map(e => (isSpecialEvent(e)
                  ? <span key={String(e._id || e.id)} className="special-dot" style={{ background: getEventTypeConfig(e).color, '--special-color': getEventTypeConfig(e).color }} />
                  : <span key={String(e._id || e.id)} style={{ background: getGameColor(e) }} />))}{tablesOn(key).length > 0 && <span className={s.rowBooking} />}</span>
                {o && o.used > 0 ? <span className={`${s.meter} ${o.over ? s.meterOver : ''}`} aria-hidden="true"><span style={{ width: `${Math.min(100, o.pct)}%` }} /></span> : <span style={{ height: 4 }} />}
              </button>
            );
          })}
        </div>
        <section aria-live="polite">
          <h3 className={`${s.dayHead} ${selected === todayKey ? s.dayHeadToday : ''}`}>
            {selected === todayKey ? 'Ma · ' : ''}{DAY_NAMES[selDate.getDay()].replace(/^./, c => c.toUpperCase())}, {MONTHS[selDate.getMonth()].toLowerCase()} {selDate.getDate()}.
          </h3>
          {dayList(selected)}
        </section>
      </div>
    );
  }

  const modalDate = dayModal ? new Date(`${dayModal}T12:00:00`) : null;
  return (
    <div className={compact ? s.compact : undefined} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {monthBar}
      <div className={s.gridScroll}>
        <div className={s.grid} onKeyDown={arrowKeys}>
          {WEEKDAYS.map(w => <span key={w} className={s.wd}>{w}</span>)}
          {Array.from({ length: lead }, (_, i) => <span key={`e${i}`} />)}
          {days.map(d => {
            const key = keyOf(d);
            const evs = byDay.get(key) || [];
            const ordered = [...evs.filter(isSpecialEvent), ...evs.filter(e => !isSpecialEvent(e))];
            const shown = ordered.length > MAX_STRIPS ? ordered.slice(0, MAX_STRIPS - 1) : ordered;
            const past = key < todayKey;
            const o = occFor(key);
            return (
              <div key={key} role="button" tabIndex={0} title="Napi események" data-day={fresh ? key : undefined} aria-label={fresh ? dayLabel(d, evs, key, o) : undefined}
                className={`${s.cell} ${past ? s.cellPast : ''} ${key === todayKey ? s.cellToday : ''}`}
                onClick={() => setDayModal(key)}
                onKeyDown={(ev) => { if (ev.target === ev.currentTarget && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); setDayModal(key); } }}>
                <span className={s.dayNum}>{d.getDate()}{key === todayKey && <span style={{ fontSize: 12, fontWeight: 700 }}> · Ma</span>}</span>
                <span className={s.strips}>
                  {shown.map(e => strip(e, past))}
                  {ordered.length > MAX_STRIPS && (
                    <button type="button" className={s.more} onClick={(ev) => { ev.stopPropagation(); setDayModal(key); }}>+{ordered.length - MAX_STRIPS + 1} további esemény</button>
                  )}
                  {tablesOn(key).length === 1 && <span className={s.tableStrip}>Foglalás {tablesOn(key)[0].from}–{tablesOn(key)[0].to}</span>}
                  {tablesOn(key).length > 1 && <span className={s.tableStrip}>{tablesOn(key).length} foglalás</span>}
                </span>
                {fillBar(o)}
                {!o?.used && evs.length === 0 && tablesOn(key).length === 0 && isClosed(d) && <span className={s.closed}>Zárva</span>}
              </div>
            );
          })}
        </div>
      </div>
      <ConfigProvider theme={tavernTheme}>
        <Modal open={!!dayModal} onCancel={() => setDayModal(null)} footer={null} width={640} closeIcon={<CloseOutlined style={{ color: '#E5B15D' }} />}
          title={modalDate && <span style={{ fontFamily: 'var(--font-cinzel), Georgia, serif', fontSize: '1.3rem', color: '#E5B15D' }}>{modalDate.getFullYear()}. {MONTHS[modalDate.getMonth()].toLowerCase()} {modalDate.getDate()}. – {DAY_NAMES[modalDate.getDay()]}</span>}>
          {dayModal && <div className={s.page} style={{ minHeight: 0, background: 'transparent' }}>{dayList(dayModal)}</div>}
        </Modal>
      </ConfigProvider>
    </div>
  );
}
