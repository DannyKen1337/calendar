"use client";
import { useState } from 'react';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { STORE_HOURS } from '@/lib/storeHours';
import { eventDay } from '@/lib/occupancy';
import { EventRows } from '@/components/MonthCalendar';
import s from './PublicCalendar.module.css';

// A nyilvános naptár heti nézete (az új kinézet): hétfőtől vasárnapig napokra bontva, ugyanazokkal az eseménysorokkal,
// mint a havi nézet napja. Az esemény nélküli napok egy rövid sorba kerülnek (Zárva / Nincs esemény), hogy kevesebbet
// kelljen görgetni. app: a szűrt eseményekkel; store: a kiválasztott bolt (a nyitvatartáshoz)
const MONTHS = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
const DAY_NAMES = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat'];
const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const mondayOf = (d) => { const m = new Date(d.getFullYear(), d.getMonth(), d.getDate()); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return m; };
const shortDate = (d) => `${MONTHS[d.getMonth()].slice(0, 3)}. ${d.getDate()}.`;

export default function WeekCalendar({ app, store }) {
  const [today] = useState(() => new Date());
  const [start, setStart] = useState(() => mondayOf(today));
  const todayKey = keyOf(today);
  const isThisWeek = keyOf(start) === keyOf(mondayOf(today));
  const goWeek = (n) => setStart(d => { const x = new Date(d); x.setDate(x.getDate() + 7 * n); return x; });
  const open = (evt) => { app.setSelectedEventDetails(evt); app.setIsEventDetailsModalOpen(true); };

  const byDay = new Map();
  for (const e of app.tournaments || []) {
    const k = eventDay(e);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(e);
  }
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
  const end = days[6];
  const range = start.getMonth() === end.getMonth() ? `${MONTHS[start.getMonth()]} ${start.getDate()}–${end.getDate()}.` : `${shortDate(start)} – ${shortDate(end)}`;

  return (
    <div className={s.week} data-het>
      <div className={s.monthBar}>
        <div className={s.monthNav}>
          <button type="button" className={s.round} onClick={() => goWeek(-1)} aria-label="Előző hét"><LeftOutlined /></button>
          <h2 className={s.monthTitle}>{range}</h2>
          <button type="button" className={s.round} onClick={() => goWeek(1)} aria-label="Következő hét"><RightOutlined /></button>
        </div>
        {!isThisWeek && <button type="button" className={s.todayBtn} onClick={() => setStart(mondayOf(today))}>Ez a hét</button>}
      </div>
      {days.map(d => {
        const key = keyOf(d);
        const list = (byDay.get(key) || []).sort((a, b) => String(a.date).localeCompare(String(b.date)));
        const isToday = key === todayKey;
        const label = `${DAY_NAMES[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}.`;
        if (list.length === 0) {
          return (
            <p key={key} className={`${s.weekEmpty} ${key < todayKey ? s.weekPast : ''}`} data-ures data-ma={isToday ? '' : undefined}>
              <b>{isToday ? 'Ma · ' : ''}{label}</b>
              <span>{STORE_HOURS[store]?.[d.getDay()] === null ? 'Zárva' : 'Nincs esemény'}</span>
            </p>
          );
        }
        return (
          <section key={key} aria-label={label} className={key < todayKey ? s.weekPast : undefined}>
            <h3 className={`${s.dayHead} ${isToday ? s.dayHeadToday : ''}`} data-ma={isToday ? '' : undefined}>{isToday ? 'Ma · ' : ''}{label}</h3>
            <ul className={s.list}><EventRows events={list} onOpen={open} fresh /></ul>
          </section>
        );
      })}
    </div>
  );
}
