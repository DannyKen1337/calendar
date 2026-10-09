"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ConfigProvider, Input, Button, Segmented, Tag, Typography } from 'antd';
import { CheckOutlined, CloseOutlined, SearchOutlined, ArrowLeftOutlined, UserAddOutlined, SyncOutlined, CalendarOutlined } from '@ant-design/icons';
import { tavernTheme, AddParticipantForm } from '@/app/components';
import { normalizeSearchText } from '@/lib/eventSearch';
import { getGameColor } from '@/lib/gameConfig';

const { Text } = Typography;

const eventKey = (evt) => String(evt._id || evt.id);
const isActiveReg = (r) => r.status === 'Aktív' || r.status === 'Active';
const hasRegistration = (evt) => !evt.isOpenAttendance && !evt.external_url;

// Eseményválasztó: a tegnapi, mai és a következő 7 nap eseményei, amelyeknél a szervező check-inelhet
function EventPicker({ app }) {
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const from = today.getTime() - 86400000;
  const to = today.getTime() + 8 * 86400000;
  const events = (app.tournaments || [])
    .filter(e => hasRegistration(e) && app.canManage(e))
    .filter(e => { const t = new Date(e.date).getTime(); return t >= from && t < to; })
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const dayLabel = (evt) => {
    const d = new Date(evt.date); d.setHours(0, 0, 0, 0);
    const diff = Math.round((d - today) / 86400000);
    return diff === 0 ? 'Ma' : diff === 1 ? 'Holnap' : diff === -1 ? 'Tegnap' : null;
  };

  return (
    <div className="flex flex-col gap-3">
      <Text style={{ color: '#baaaac' }}>Válaszd ki az eseményt, amelyiknél a megjelenést rögzíted:</Text>
      {events.length === 0 && <div className="bg-[#1a1012] rounded-xl border border-[#4A2E33] p-6 text-center"><Text style={{ color: '#6b7280', fontStyle: 'italic' }}>Nincs közelgő esemény jelentkezéssel.</Text></div>}
      {events.map(evt => {
        const label = dayLabel(evt);
        const regs = (app.registrations || []).filter(r => String(r.tournamentId) === eventKey(evt));
        const checked = regs.filter(r => r.attended === true).length;
        return (
          <button
            key={eventKey(evt)}
            type="button"
            onClick={() => router.push(`/admin/checkin?event=${encodeURIComponent(eventKey(evt))}`)}
            className="text-left bg-[#1a1012] rounded-xl border border-[#4A2E33] p-4 cursor-pointer active:bg-[#2B1A1C]"
            style={{ borderLeft: `4px solid ${getGameColor(evt)}` }}
          >
            <div className="flex items-center gap-2 mb-1">
              {label && <Tag color={label === 'Ma' ? 'gold' : 'default'} style={{ margin: 0 }}>{label}</Tag>}
              <Text style={{ color: '#baaaac', fontSize: 13 }}><CalendarOutlined /> {app.formatEventDate(evt.date)}</Text>
            </div>
            <div style={{ color: '#E0D6C8', fontSize: 18, fontWeight: 'bold' }}>{evt.name}</div>
            <Text style={{ color: '#9a8a8c', fontSize: 13 }}>{evt.category} · {checked} / {regs.filter(isActiveReg).length} megjelent</Text>
          </button>
        );
      })}
    </div>
  );
}

const FILTERS = [
  { value: 'all', label: 'Mind' },
  { value: 'pending', label: 'Nincs jelölve' },
  { value: 'yes', label: 'Megjelent' },
  { value: 'no', label: 'Nem jött' },
];

// Telefonos check-in: nagy gombok, keresés névre, szűrés állapotra
export default function CheckinView({ app, eventId }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const event = eventId ? (app.tournaments || []).find(t => eventKey(t) === String(eventId)) : null;

  const header = (
    <div className="flex items-center justify-between gap-3 border-b border-[#4A2E33] pb-3">
      <Link href={eventId ? '/admin/checkin' : '/admin'} className="text-[#E5B15D] flex items-center gap-2 font-bold">
        <ArrowLeftOutlined /> {eventId ? 'Események' : 'Admin'}
      </Link>
      <span className="text-[#E5B15D] font-serif text-xl font-bold">Check-in</span>
    </div>
  );

  if (!eventId) {
    return <ConfigProvider theme={tavernTheme}><div className="flex flex-col gap-4">{header}<EventPicker app={app} /></div></ConfigProvider>;
  }

  if (!event || !app.canManage(event) || !hasRegistration(event)) {
    return (
      <ConfigProvider theme={tavernTheme}>
        <div className="flex flex-col gap-4">
          {header}
          <div className="bg-[#1a1012] rounded-xl border border-[#4A2E33] p-6 text-center">
            <Text style={{ color: '#baaaac' }}>{!event ? 'Az esemény nem található.' : !hasRegistration(event) ? 'Ennél az eseménynél nincs jelentkezés.' : 'Ennek a játéknak az eseményeit nem kezelheted.'}</Text>
          </div>
        </div>
      </ConfigProvider>
    );
  }

  const regs = (app.registrations || [])
    .filter(r => String(r.tournamentId) === eventKey(event))
    .sort((a, b) => (isActiveReg(b) - isActiveReg(a)) || (new Date(a.date) - new Date(b.date)));
  const counts = {
    yes: regs.filter(r => r.attended === true).length,
    no: regs.filter(r => r.attended === false).length,
    pending: regs.filter(r => r.attended !== true && r.attended !== false).length,
  };
  const tokens = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  const visible = regs.filter(r => {
    if (filter === 'yes' && r.attended !== true) return false;
    if (filter === 'no' && r.attended !== false) return false;
    if (filter === 'pending' && (r.attended === true || r.attended === false)) return false;
    const hay = normalizeSearchText(`${r.username || ''} ${r.name || ''}`);
    return tokens.every(t => hay.includes(t));
  });

  const refresh = async () => {
    setRefreshing(true);
    await app.fetchData(true);
    setRefreshing(false);
  };

  return (
    <ConfigProvider theme={tavernTheme}>
      <div className="flex flex-col gap-3">
        {header}
        <div>
          <div style={{ color: '#E0D6C8', fontSize: 20, fontWeight: 'bold', lineHeight: 1.3 }}>{event.name}</div>
          <Text style={{ color: '#9a8a8c' }}>{app.formatEventDate(event.date)} · {event.category}</Text>
        </div>

        {/* Kereső és számlálók: görgetéskor is a képernyő tetején maradnak */}
        <div className="sticky top-0 z-10 bg-[#121212] pt-2 pb-3 flex flex-col gap-2">
          <div className="flex gap-2">
            <Input size="large" allowClear prefix={<SearchOutlined style={{ color: '#E5B15D' }} />} placeholder="Név keresése..." value={query} onChange={(e) => setQuery(e.target.value)} />
            <Button size="large" icon={<SyncOutlined spin={refreshing} />} onClick={refresh} aria-label="Frissítés" />
          </div>
          <Segmented block value={filter} onChange={setFilter} options={FILTERS.map(f => ({ value: f.value, label: f.value === 'all' ? `${f.label} (${regs.length})` : `${f.label} (${counts[f.value]})` }))} />
        </div>

        {visible.length === 0 && (
          <div className="bg-[#1a1012] rounded-xl border border-[#4A2E33] p-6 text-center">
            <Text style={{ color: '#6b7280', fontStyle: 'italic' }}>{regs.length === 0 ? 'Még nincs jelentkező.' : 'Nincs a keresésnek megfelelő jelentkező.'}</Text>
          </div>
        )}

        {visible.map(r => {
          const id = r._id || r.id;
          const yes = r.attended === true;
          const no = r.attended === false;
          return (
            <div key={String(id)} className="bg-[#1a1012] rounded-xl border p-3 flex items-center gap-3" style={{ borderColor: yes ? '#389e0d' : no ? '#a8071a' : '#4A2E33' }}>
              <div className="flex-1 min-w-0">
                <div style={{ color: '#E5B15D', fontWeight: 'bold', fontSize: 17, overflowWrap: 'anywhere' }}>{r.username || r.name}</div>
                {r.username && r.name && r.name !== r.username && <div style={{ color: '#E0D6C8', fontSize: 14, overflowWrap: 'anywhere' }}>{r.name}</div>}
                {!isActiveReg(r) && <Tag color="warning" style={{ marginTop: 4 }}>Várólista</Tag>}
              </div>
              <Button
                size="large"
                icon={<CheckOutlined />}
                aria-label="Megjelent"
                onClick={() => app.setAttendance(id, yes ? null : true)}
                style={{ width: 56, height: 56, fontSize: 22, ...(yes ? { background: '#389e0d', borderColor: '#389e0d', color: '#fff' } : { background: '#2B1A1C', borderColor: '#4A2E33', color: '#E0D6C8' }) }}
              />
              <Button
                size="large"
                icon={<CloseOutlined />}
                aria-label="Nem jelent meg"
                onClick={() => app.setAttendance(id, no ? null : false)}
                style={{ width: 56, height: 56, fontSize: 22, ...(no ? { background: '#a8071a', borderColor: '#a8071a', color: '#fff' } : { background: '#2B1A1C', borderColor: '#4A2E33', color: '#E0D6C8' }) }}
              />
            </div>
          );
        })}

        <div className="mt-2">
          {showAdd
            ? <AddParticipantForm key={eventKey(event)} event={event} app={app} />
            : <Button block size="large" icon={<UserAddOutlined />} onClick={() => setShowAdd(true)} style={{ background: '#2B1A1C', borderColor: '#4A2E33', color: '#E5B15D' }}>Helyszíni jelentkező felvétele</Button>}
        </div>
        <Text style={{ color: '#7d6e70', fontSize: 12 }}>Újrakoppintással a jelölés visszavonható. Ha mások is pipálnak egyszerre, a frissítés gombbal töltheted be a változásokat.</Text>
      </div>
    </ConfigProvider>
  );
}
