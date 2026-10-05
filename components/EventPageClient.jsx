"use client";
import { useState } from 'react';
import Link from 'next/link';
import { ConfigProvider, Button, Tag } from 'antd';
import { ArrowLeftOutlined, CalendarOutlined, EnvironmentOutlined, LinkOutlined, StarFilled, TeamOutlined, UsergroupAddOutlined } from '@ant-design/icons';
import { useCalendar } from '@/app/useCalendar';
import { PublicModals, AttendeeNames, ShareEventButton, STORES, tavernTheme, getCategoryImage } from '@/app/components';
import { getGameColor } from '@/lib/gameConfig';

// Megosztható eseményoldal (/esemeny/[id]). A szerver által betöltött adatokkal azonnal megjelenik,
// majd a naptár adataiból frissül (pl. jelentkezés után a létszám).
export default function EventPageClient({ eventId, initialEvent, maintenance = false }) {
  const app = useCalendar();
  const [now] = useState(() => Date.now());
  const live = (app.tournaments || []).find(t => String(t._id) === String(eventId) || String(t.id) === String(eventId));
  const evt = live || initialEvent;
  const isStaff = app.userRole === 'admin' || app.userRole === 'owner';

  if (maintenance && !isStaff) {
    if (app.loading) return <Shell><p className="text-[#E5B15D] font-bold text-xl text-center">Betöltés...</p></Shell>;
    return (
      <Shell>
        <h1 className="text-3xl font-bold text-[#E5B15D] font-serif mb-4 text-center">Karbantartás alatt 🛠️</h1>
        <p className="text-[#E0D6C8] text-center">A Tavern rendszerei jelenleg karbantartás alatt állnak. Kérjük, látogass vissza később!</p>
      </Shell>
    );
  }
  if (!evt) {
    return <Shell><p className="text-[#E5B15D] font-bold text-xl text-center">{app.loading ? 'Betöltés...' : 'Az esemény nem található.'}</p></Shell>;
  }

  const color = getGameColor(evt);
  const store = STORES[evt.store || 'debrecen'];
  const isFull = !evt.isOpenAttendance && evt.current_players >= evt.max_players;
  const attendees = evt.attendees || [];
  const active = attendees.filter(a => !a.queue);
  const queued = attendees.filter(a => a.queue);
  const isPast = new Date(evt.date).getTime() < now;

  let action = null;
  if (evt.isOpenAttendance) {
    action = <p className="text-[#baaaac] m-0">Kötetlen létszám – nincs jelentkezés, gyere el nyugodtan!</p>;
  } else if (evt.external_url) {
    action = <Button type="primary" size="large" icon={<LinkOutlined />} style={{ color: '#000', fontWeight: 'bold' }} onClick={() => app.initiateJoin(evt)}>Tovább a jelentkezéshez</Button>;
  } else if (isPast) {
    action = <Tag style={{ fontSize: 14, padding: '4px 12px' }}>Az esemény már lezajlott</Tag>;
  } else {
    action = (
      <div className="flex flex-wrap items-center gap-3">
        <Button type="primary" size="large" disabled={!evt.is_open} icon={isFull ? <UsergroupAddOutlined /> : <TeamOutlined />} style={{ color: '#000', fontWeight: 'bold' }} onClick={() => app.initiateJoin(evt)}>
          {!evt.is_open ? 'Jelentkezés lezárva' : isFull ? 'Jelentkezés várólistára' : 'Jelentkezem'}
        </Button>
        <Button type="link" danger onClick={() => app.initiateUnsubscribe(evt)}>Leiratkozás</Button>
      </div>
    );
  }

  return (
    <ConfigProvider theme={tavernTheme}>
      {app.contextHolder}
      <Shell wide>
        <Link href="/" className="inline-flex items-center gap-2 text-[#E5B15D] hover:text-[#f3cf8c] font-bold mb-6">
          <ArrowLeftOutlined /> Vissza a naptárhoz
        </Link>

        <article className="bg-[#1a1012] rounded-2xl border-2 overflow-hidden" style={{ borderColor: evt.isFeatured ? '#FFD700' : '#4A2E33' }}>
          <div style={{ height: 8, background: color }} />
          <div className="p-6 md:p-8 flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row gap-6 sm:items-center">
              <div className="w-28 h-28 shrink-0 bg-[#0a0a0a] rounded-2xl border-2 border-[#4A2E33] p-3 flex items-center justify-center">
                <img src={evt.imageUrl || getCategoryImage(evt.category)} alt={evt.category || ''} className="w-full h-full object-contain" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2 mb-2">
                  <Tag style={{ background: color, borderColor: color, color: '#fff', margin: 0 }}>{evt.category || 'Egyéb'}</Tag>
                  {evt.isFeatured && <Tag icon={<StarFilled />} color="gold" style={{ margin: 0, fontWeight: 'bold' }}>Kiemelt</Tag>}
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-[#E5B15D] font-serif m-0 break-words">{evt.name}</h1>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="bg-[#2B1A1C] rounded-xl border border-[#4A2E33] px-4 py-3 flex items-center gap-3">
                <CalendarOutlined className="text-[#E5B15D] text-xl" />
                <span className="text-[#E0D6C8]">{app.formatEventDate(evt.date)}</span>
              </div>
              <div className="bg-[#2B1A1C] rounded-xl border border-[#4A2E33] px-4 py-3 flex items-center gap-3">
                <EnvironmentOutlined className="text-[#E5B15D] text-xl" />
                <span className="text-[#E0D6C8]">{store?.name || 'Tavern'}</span>
              </div>
            </div>

            {!evt.isOpenAttendance && !evt.external_url && (
              <div className="bg-[#2B1A1C] rounded-xl border border-[#4A2E33] px-4 py-3">
                <strong className="text-[#E5B15D]">Létszám: </strong>
                <span className="text-[#E0D6C8]">{evt.current_players} / {evt.max_players}</span>
                {evt.queue_count > 0 && <span className="text-[#baaaac]"> · várólistán: {evt.queue_count}</span>}
                {active.length > 0 && <AttendeeNames attendees={active} />}
                {queued.length > 0 && <div className="mt-2"><span className="text-[#baaaac] text-sm">Várólistán:</span><AttendeeNames attendees={queued} /></div>}
              </div>
            )}

            {evt.description && (
              <div className="bg-[#2B1A1C] rounded-xl border border-[#4A2E33] px-4 py-3">
                <strong className="text-[#E5B15D]">Leírás</strong>
                <p className="text-[#baaaac] mt-2 mb-0" style={{ whiteSpace: 'pre-wrap' }}>{evt.description}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#4A2E33] pt-5">
              {action}
              <ShareEventButton evt={evt} messageApi={app.messageApi} size="large" />
            </div>
          </div>
        </article>
      </Shell>
      <PublicModals app={app} />
    </ConfigProvider>
  );
}

function Shell({ children, wide = false }) {
  return (
    <main className="min-h-screen bg-[#121212] text-white p-4 md:p-8 flex justify-center">
      <div className={`w-full ${wide ? 'max-w-3xl' : 'max-w-lg self-center'}`}>{children}</div>
    </main>
  );
}
