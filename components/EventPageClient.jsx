"use client";
import { useState } from 'react';
import Link from 'next/link';
import { ConfigProvider } from 'antd';
import { useCalendar } from '@/app/useCalendar';
import { PublicModals, AttendeeNames, ShareEventButton, EventTypeTag, STORES, tavernTheme, getCategoryImage } from '@/app/components';
import { isSpecialEvent, getEventTypeConfig } from '@/lib/eventTypes';
import { getGameColor } from '@/lib/gameConfig';
import s from './EventPage.module.css';

// Megosztható eseményoldal (/esemeny/[id]). A szerver által betöltött adatokkal azonnal megjelenik,
// majd a naptár adataiból frissül (pl. jelentkezés után a létszám). A nyilvános naptár kinézete (sötét alap, arany,
// Cinzel + Manrope); telefonon a jelentkezés gombja a képernyő alján ragad, így görgetés nélkül is elérhető.
const Icon = ({ d }) => <svg className={s.icon} viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
const CALENDAR = 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM4 10h16M8 3v4M16 3v4';
const PIN = 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z';

export default function EventPageClient({ eventId, initialEvent, maintenance = false }) {
  const app = useCalendar();
  const [now] = useState(() => Date.now());
  const live = (app.tournaments || []).find(t => String(t._id) === String(eventId) || String(t.id) === String(eventId));
  const evt = live || initialEvent;
  const isStaff = app.userRole === 'admin' || app.userRole === 'owner';

  if (maintenance && !isStaff) {
    return (
      <Shell>
        {app.loading ? <p className={s.status} role="status">Betöltés…</p> : (
          <div className={s.card}>
            <h1 className={s.title}>Karbantartás alatt</h1>
            <p className={s.muted}>A Tavern rendszerei jelenleg karbantartás alatt állnak. Kérjük, látogass vissza később!</p>
          </div>
        )}
      </Shell>
    );
  }
  if (!evt) {
    return <Shell><p className={s.status} role="status">{app.loading ? 'Betöltés…' : 'Az esemény nem található.'}</p></Shell>;
  }

  const special = isSpecialEvent(evt) ? getEventTypeConfig(evt) : null;
  const color = getGameColor(evt);
  const store = STORES[evt.store || 'debrecen'];
  const counted = !evt.isOpenAttendance && !evt.external_url;
  const isFull = !evt.isOpenAttendance && evt.current_players >= evt.max_players;
  const free = Math.max(0, (evt.max_players || 0) - (evt.current_players || 0));
  const attendees = evt.attendees || [];
  const active = attendees.filter(a => !a.queue);
  const queued = attendees.filter(a => a.queue);
  const isPast = new Date(evt.date).getTime() < now;

  let action = null;
  if (evt.isOpenAttendance) {
    action = <p className={s.note}>{evt.eventType === 'community' ? 'Nincs jelentkezés – gyere el nyugodtan!' : 'Kötetlen létszám – nincs jelentkezés, gyere el nyugodtan!'}</p>;
  } else if (evt.external_url) {
    action = <button type="button" className={s.primary} onClick={() => app.initiateJoin(evt)}>Tovább a jelentkezéshez</button>;
  } else if (isPast) {
    action = <p className={s.note}>Az esemény már lezajlott.</p>;
  } else {
    action = (
      <>
        <button type="button" className={s.primary} disabled={!evt.is_open} onClick={() => app.initiateJoin(evt)}>
          {!evt.is_open ? 'Jelentkezés lezárva' : isFull ? 'Jelentkezés várólistára' : 'Jelentkezem'}
        </button>
        <button type="button" className={s.secondary} onClick={() => app.initiateUnsubscribe(evt)}>Leiratkozás</button>
      </>
    );
  }

  return (
    <ConfigProvider theme={tavernTheme}>
      {app.contextHolder}
      <Shell>
        <Link href="/" className={s.back}>‹ Vissza a naptárhoz</Link>

        <article className={s.card} style={{ boxShadow: `inset 0 0 0 1.5px ${special ? special.color : evt.isFeatured ? '#e5b15d' : '#241b1d'}` }}>
          <div className={s.stripe} style={{ background: special ? special.gradient : color }} aria-hidden="true" />
          <header className={s.head}>
            <span className={s.logo}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={evt.imageUrl || getCategoryImage(evt.category)} alt="" />
            </span>
            <div className={s.headText}>
              <div className={s.tags}>
                <EventTypeTag evt={evt} />
                <span className={s.tag}><i style={{ background: color }} aria-hidden="true" />{evt.category || 'Egyéb'}</span>
                {evt.isFeatured && <span className={`${s.tag} ${s.tagGold}`}>Kiemelt</span>}
              </div>
              <h1 className={s.title}>{evt.name}</h1>
            </div>
          </header>

          <ul className={s.facts}>
            <li><Icon d={CALENDAR} />{app.formatEventDate(evt.date)}</li>
            <li><Icon d={PIN} />{store?.name || 'Tavern'}</li>
          </ul>

          {counted && (
            <section className={s.box} aria-label="Létszám">
              <div className={s.countRow}>
                <b className={s.count}>{evt.current_players}<span> / {evt.max_players}</span></b>
                <span className={isFull ? s.full : s.free}>{isFull ? `Betelt${evt.queue_count > 0 ? ` · ${evt.queue_count} várólistán` : ''}` : `${free} hely szabad`}</span>
              </div>
              <span className={s.meter} data-sav aria-hidden="true"><span style={{ width: `${evt.max_players ? Math.min(100, (evt.current_players / evt.max_players) * 100) : 0}%` }} /></span>
              {active.length > 0 && <AttendeeNames attendees={active} />}
              {queued.length > 0 && <><p className={s.label}>Várólistán</p><AttendeeNames attendees={queued} /></>}
            </section>
          )}

          {evt.description && (
            <section className={s.box} aria-label="Leírás">
              <p className={s.label}>Leírás</p>
              <p className={s.desc}>{evt.description}</p>
            </section>
          )}

          <div className={s.actions}>
            {action}
            {!isPast && <a className={s.calendar} href={`/api/export?event=${encodeURIComponent(String(evt._id || evt.id))}`}>Naptárba</a>}
            <ShareEventButton evt={evt} messageApi={app.messageApi} className={s.share} iconOnly aria-label="Megosztás" title="Megosztás" />
          </div>
        </article>
      </Shell>
      <PublicModals app={app} />
    </ConfigProvider>
  );
}

function Shell({ children }) {
  return (
    <main className={s.page}>
      <div className={s.wrap}>{children}</div>
    </main>
  );
}
