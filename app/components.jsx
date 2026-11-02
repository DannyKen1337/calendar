"use client";
import React, { useState } from "react";
import { Card, Button, Typography, Tag, Space, List, Popconfirm, Table, Modal, Divider, Grid, Form, Input, Select, ConfigProvider, theme, Checkbox, Radio } from "antd";
import { TeamOutlined, CalendarOutlined, LinkOutlined, ShareAltOutlined, CheckOutlined, StopOutlined, UsergroupAddOutlined, DeleteOutlined, PlusOutlined, CloseOutlined, EyeOutlined, LeftOutlined, RightOutlined, StarFilled, UserAddOutlined, SearchOutlined, MobileOutlined, WarningOutlined } from "@ant-design/icons";
import { S } from "./styles";
import { resolveAttendance } from '@/lib/attendance';
import { GAME_CONFIG, getGameConfig, getGameColor } from '@/lib/gameConfig'; 
import { EVENT_TYPES, getEventTypeConfig, isSpecialEvent, showsDecklist } from '@/lib/eventTypes';
import { findHostConflicts } from '@/lib/hostConflicts';

import { rgnEventId } from '@/lib/rgn';
import RgnAttendeesModal from '@/components/RgnAttendeesModal';
import { getOpeningHoursWarning } from '@/lib/storeHours';

const { Title, Text, Paragraph } = Typography;
const { useBreakpoint } = Grid;

export const tavernTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#E5B15D',       
    colorBgBase: '#121212',        
    colorBgElevated: '#1a1012',    
    colorBorder: '#4A2E33',        
    colorBorderSecondary: '#4A2E33',
    colorText: '#E0D6C8',          
    colorTextHeading: '#E5B15D',   
  },
  components: {
    Modal: { contentBg: '#1a1012', headerBg: '#1a1012', paddingMD: 24 },
    Table: { colorBgContainer: '#2B1A1C', headerBg: '#1a1012', borderColor: '#4A2E33' },
    Input: { colorBgContainer: '#2B1A1C' },
    Select: { colorBgContainer: '#2B1A1C' }
  }
};

const defaultLogoUrl = '/jatekok/egyeb.png';

export const STORES = {
  debrecen: { id: 'debrecen', name: 'Tavern Debrecen', color: '#E5B15D', icon: '🏰' },
  miskolc: { id: 'miskolc', name: 'Tavern Miskolc', color: '#8b5cf6', icon: '⛰️' },
  jatekceh: { id: 'jatekceh', name: 'JátékCéh', color: '#10b981', icon: '🎲' }
};

export { getGameConfig };

export const getCategoryImage = (category) => {
  return getGameConfig(category).logo || defaultLogoUrl;
};


export const registrationPageUrl = (evt) => `/jelentkezes/${encodeURIComponent(String(evt._id || evt.id))}`;
export const checkinPageUrl = (evt) => `/admin/checkin?event=${encodeURIComponent(String(evt._id || evt.id))}`;

export const eventShareUrl = (evt) => `${window.location.origin}/esemeny/${encodeURIComponent(String(evt._id || evt.id))}`;

// Esemény megosztása: telefonon a rendszer megosztó menüje, gépen a link vágólapra másolása.
// copyOnly: mindig azonnal vágólapra másol (admin felület); iconOnly: csak ikon, felirat nélkül
export const ShareEventButton = ({ evt, messageApi, copyOnly = false, iconOnly = false, ...buttonProps }) => {
  const share = async () => {
    const url = eventShareUrl(evt);
    if (!copyOnly && navigator.share) {
      try { await navigator.share({ title: evt.name, url }); return; }
      catch (e) { if (e?.name === 'AbortError') return; /* egyébként vágólapra másolunk */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      messageApi?.success('Link vágólapra másolva!');
    } catch {
      messageApi?.info({ content: url, duration: 10 });
    }
  };
  return <Button icon={<ShareAltOutlined />} onClick={share} title={copyOnly ? 'Megosztás – link másolása' : undefined} {...buttonProps}>{iconOnly ? null : 'Megosztás'}</Button>;
};

// Különleges esemény (szett megjelenés, expo...) címkéje; versenynél nem jelenik meg
export const EventTypeTag = ({ evt, size = 'default' }) => {
  if (!isSpecialEvent(evt)) return null;
  const t = getEventTypeConfig(evt);
  const big = size === 'large';
  return (
    <Tag style={{ background: t.gradient, border: `1px solid ${t.color}`, color: '#fff', fontWeight: 'bold', fontSize: big ? 14 : 12, padding: big ? '4px 12px' : '1px 8px', textShadow: '0 1px 2px rgba(0,0,0,0.5)', boxShadow: `0 0 8px ${t.color}88` }}>
      {t.icon} {t.label}
    </Tag>
  );
};

// Játékszűrésnél a másik bolt eseménye (lásd PublicCalendar): halványan, a bolt nevével jelenik meg
const otherStore = (evt) => (evt._otherStore ? STORES[evt._otherStore] : null);
const OtherStoreTag = ({ evt }) => { const s = otherStore(evt); return s ? <Tag style={{ margin: 0, background: 'transparent', borderColor: s.color, color: s.color }}>{s.icon} {s.name}</Tag> : null; };

// A különleges események megjelenéséhez (keret, fény) a globals.css a --special-color változót használja
const specialVars = (evt) => (isSpecialEvent(evt) ? { '--special-color': getEventTypeConfig(evt).color } : {});

// Jelentkezők rövidített nevei (Vezetéknév + kezdőbetű); `max` felett "+N" jelzéssel
export const AttendeeNames = ({ attendees, max = Infinity, size = 'default' }) => {
  const list = attendees || [];
  if (list.length === 0) return null;
  const shown = list.slice(0, max);
  const rest = list.length - shown.length;
  const fontSize = size === 'small' ? '12px' : '14px';
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
      {shown.map((a, i) => (
        <Tag key={i} style={{ margin: 0, fontSize, background: a.queue ? 'transparent' : '#3a2a14', color: a.queue ? '#baaaac' : '#E5B15D', borderColor: a.queue ? '#4A2E33' : '#6b4f22', borderStyle: a.queue ? 'dashed' : 'solid' }} title={a.queue ? 'Várólistán' : undefined}>{a.name}</Tag>
      ))}
      {rest > 0 && <Tag style={{ margin: 0, fontSize, background: 'transparent', color: '#baaaac', borderColor: '#4A2E33' }}>+{rest}</Tag>}
    </div>
  );
};

export const PublicModals = ({ app }) => {
  if (!app) return null;
  const { 
    isEventDetailsModalOpen, setIsEventDetailsModalOpen, selectedEventDetails, formatEventDate, initiateJoin, 
    selectedEventToJoin,
    isUnsubscribeModalOpen, setIsUnsubscribeModalOpen, unsubscribeForm, initiateUnsubscribe, submitUnsubscribe, isUnsubscribing,
    isAuthModalOpen, setIsAuthModalOpen, isRegistering, setIsRegistering, authForm, handleAuthSubmit, canRegister
  } = app;
  
  return (
    <>
      <Modal title={<span style={{ fontSize: '1.4rem', fontFamily: 'Georgia, serif' }}>Esemény részletei</span>} open={isEventDetailsModalOpen} onCancel={() => setIsEventDetailsModalOpen(false)} closeIcon={<CloseOutlined style={{ color: '#E5B15D' }} />} footer={[
          <Button key="close" onClick={() => setIsEventDetailsModalOpen(false)}>Bezárás</Button>,
          selectedEventDetails ? <ShareEventButton key="share" evt={selectedEventDetails} messageApi={app.messageApi} /> : null,
          selectedEventDetails?.isOpenAttendance ? null : selectedEventDetails?.external_url ? ( <Button key="ext" type="primary" style={{ color: '#000', fontWeight: 'bold' }} onClick={() => { window.open(selectedEventDetails.external_url, '_blank', 'noopener,noreferrer'); setIsEventDetailsModalOpen(false); }}>Tovább a weboldalra</Button> ) : ( <Button key="join" type="primary" style={{ color: '#000', fontWeight: 'bold' }} disabled={!selectedEventDetails?.is_open} onClick={() => initiateJoin(selectedEventDetails)}>{selectedEventDetails?.is_open ? 'Jelentkezés' : 'Lezárva'}</Button> )
        ]}>
        {selectedEventDetails && (() => {
          const detailsTagColor = getGameColor(selectedEventDetails);
          return (
          <div className="space-y-4 pt-4">
            <div className="flex justify-center mb-6">
              <div className="bg-[#0a0a0a] p-4 rounded-2xl border-2 border-[#4A2E33] shadow-lg flex items-center justify-center" style={{ width: '150px', height: '150px' }}>
                <img src={selectedEventDetails.imageUrl || getCategoryImage(selectedEventDetails.category)} alt={selectedEventDetails.category} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { if (e.target.getAttribute('data-retried') !== 'true') { e.target.setAttribute('data-retried', 'true'); e.target.src = getCategoryImage(selectedEventDetails.category); } else { e.target.src = defaultLogoUrl; } }} />
              </div>
            </div>
            <div className="text-center mb-6">
              <Title level={3} style={{ margin: '0 0 10px 0' }}>{selectedEventDetails.name}</Title>
              <Tag color={detailsTagColor} style={{ background: detailsTagColor, borderColor: detailsTagColor, color: '#fff', fontSize: '14px', padding: '4px 12px' }}>{selectedEventDetails.category}</Tag>
              {selectedEventDetails.isFeatured && <Tag icon={<StarFilled />} color="gold" style={{ fontSize: '14px', padding: '4px 12px', fontWeight: 'bold', marginLeft: 8 }}>Kiemelt</Tag>}
              {isSpecialEvent(selectedEventDetails) && <div className="mt-2"><EventTypeTag evt={selectedEventDetails} size="large" /></div>}
            </div>
            <div className="bg-[#2B1A1C] p-4 rounded-xl border border-[#4A2E33]">
              <p className="mb-2"><strong style={{ color: '#E5B15D' }}>Időpont:</strong> {formatEventDate(selectedEventDetails.date)}</p>
              {selectedEventDetails._otherStore && <p className="mb-2"><strong style={{ color: '#E5B15D' }}>Helyszín:</strong> {STORES[selectedEventDetails._otherStore]?.icon} {STORES[selectedEventDetails._otherStore]?.name} <span style={{ color: '#9a8a8c' }}>(másik bolt)</span></p>}
              
              {!selectedEventDetails.isOpenAttendance && !selectedEventDetails.external_url && ( <p><strong style={{ color: '#E5B15D' }}>Létszám:</strong> {selectedEventDetails.current_players} / {selectedEventDetails.max_players}</p> )}
              {selectedEventDetails.external_url && rgnEventId(selectedEventDetails.external_url) && selectedEventDetails.rgn?.syncedAt && selectedEventDetails.rgn?.ok !== false && ( <p><strong style={{ color: '#E5B15D' }}>Létszám:</strong> {selectedEventDetails.current_players}{selectedEventDetails.rgn.capacity ? ` / ${selectedEventDetails.rgn.capacity}` : ''}{selectedEventDetails.queue_count > 0 ? ` (várólistán: ${selectedEventDetails.queue_count})` : ''} <span style={{ color: '#9a8a8c' }}>· a Riftbound oldal szerint</span></p> )}
            </div>
            {!selectedEventDetails.isOpenAttendance && !selectedEventDetails.external_url && (selectedEventDetails.attendees || []).length > 0 && (() => {
              const active = selectedEventDetails.attendees.filter(a => !a.queue);
              const queued = selectedEventDetails.attendees.filter(a => a.queue);
              return (
                <div className="bg-[#2B1A1C] p-4 rounded-xl border border-[#4A2E33] mt-4">
                  <strong style={{ color: '#E5B15D' }}>Jelentkeztek ({active.length}):</strong>
                  {active.length > 0 ? <AttendeeNames attendees={active} /> : <p style={{ color: '#6b7280', fontStyle: 'italic', margin: '6px 0 0' }}>Még senki.</p>}
                  {queued.length > 0 && (<><strong style={{ color: '#baaaac', display: 'block', marginTop: 12 }}>Várólistán ({queued.length}):</strong><AttendeeNames attendees={queued} /></>)}
                </div>
              );
            })()}
            {selectedEventDetails.description && (
              <div className="bg-[#2B1A1C] p-4 rounded-xl border border-[#4A2E33] mt-4"><strong style={{ color: '#E5B15D' }}>Leírás:</strong><p style={{ whiteSpace: 'pre-wrap', marginTop: 8, color: '#baaaac' }}>{selectedEventDetails.description}</p></div>
            )}
            {!selectedEventDetails.isOpenAttendance && !selectedEventDetails.external_url && (
              <div style={{ textAlign: 'center', marginTop: 10 }}>
                <Button type="link" danger onClick={() => initiateUnsubscribe(selectedEventDetails)}>Már jelentkeztem, de le szeretnék iratkozni</Button>
              </div>
            )}
          </div>
          );
        })()}
      </Modal>

      <Modal title={<span style={{ color: '#ff4d4f', fontSize: '1.2rem', fontFamily: 'Georgia, serif' }}>Leiratkozás</span>} open={isUnsubscribeModalOpen} onCancel={() => setIsUnsubscribeModalOpen(false)} onOk={() => unsubscribeForm.submit()} confirmLoading={isUnsubscribing} closeIcon={<CloseOutlined style={{ color: '#ff4d4f' }} />} okText="Leiratkozás" cancelText="Mégse" okButtonProps={{ danger: true }}>
        <Form form={unsubscribeForm} layout="vertical" onFinish={submitUnsubscribe} className="mt-4">
          <p style={{ marginBottom: 15, color: '#baaaac' }}>Add meg az e-mail címed, amivel jelentkeztél a(z) <b style={{color: '#E5B15D'}}>{selectedEventToJoin?.name}</b> eseményre:</p>
          <Form.Item name="email" label="E-mail cím" normalize={(v) => (typeof v === 'string' ? v.trim() : v)} rules={[{ required: true, type: 'email', message: 'Érvényes e-mail kell!' }]}><Input type="email" inputMode="email" autoComplete="email" placeholder="pelda@email.com" /></Form.Item>
        </Form>
      </Modal>

      <Modal 
        title={<span style={{ fontSize: '1.3rem', fontFamily: 'Georgia, serif', color: '#E5B15D' }}>{isRegistering ? 'Új Admin Regisztrálása' : 'Adminisztrátori Belépés'}</span>} 
        open={isAuthModalOpen} 
        onCancel={() => { setIsAuthModalOpen(false); authForm.resetFields(); }} 
        onOk={() => authForm.submit()} 
        closeIcon={<CloseOutlined style={{ color: '#E5B15D' }} />} 
        okText={isRegistering ? 'Regisztráció' : 'Belépés'} 
        cancelText="Mégse" 
        okButtonProps={{ style: { color: '#000', fontWeight: 'bold' } }}
      >
        <Form form={authForm} layout="vertical" onFinish={handleAuthSubmit} className="mt-4">
          {!isRegistering && (
            <Form.Item name="loginId" label="Felhasználónév vagy E-mail" rules={[{ required: true, message: 'Kötelező megadni!' }]}>
              <Input placeholder="admin / admin@tavern.hu" size="large" />
            </Form.Item>
          )}
          {isRegistering && (
            <>
              <Form.Item name="username" label="Felhasználónév" rules={[{ required: true, message: 'Kötelező megadni!' }]}>
                <Input placeholder="Pl.: tavern_admin" size="large" />
              </Form.Item>
              <Form.Item name="email" label="E-mail cím" rules={[{ required: true, type: 'email', message: 'Érvényes e-mail címet adj meg!' }]}>
                <Input placeholder="admin@tavern.hu" size="large" />
              </Form.Item>
            </>
          )}
          <Form.Item name="password" label="Jelszó" rules={[{ required: true, message: 'Kötelező megadni!' }]}>
            <Input.Password placeholder="********" size="large" />
          </Form.Item>
          {canRegister && (
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <Button type="link" onClick={() => { setIsRegistering(!isRegistering); authForm.resetFields(); }} style={{ color: '#baaaac', textDecoration: 'underline' }}>
                {isRegistering ? 'Már van fiókod? Lépj be itt!' : 'Nincs még fiókod? Regisztrálj!'}
              </Button>
            </div>
          )}
        </Form>
      </Modal>
    </>
  );
};

// grid: az események kártyarácsban, annyi oszlopban, amennyi kifér (admin felület); egyébként egyoszlopos lista
export const EventList = ({ tournamentsData, app }) => {
  const { formatEventDate, initiateJoin, initiateUnsubscribe, setSelectedEventDetails, setIsEventDetailsModalOpen } = app;
  const renderCard = (evt) => {
      const isFull = evt.current_players >= evt.max_players;
      let btnText = "Csatlakozom!"; let btnType = "primary"; let btnIcon = <TeamOutlined />;
      if (evt.external_url) { btnText = "Tovább a weboldalra"; btnType = "default"; btnIcon = <LinkOutlined />; } 
      else if (isFull) { btnText = "Várólista"; btnType = "dashed"; btnIcon = <UsergroupAddOutlined />; }
      
      const eventColor = getGameColor(evt);
      const special = isSpecialEvent(evt) ? getEventTypeConfig(evt) : null;

      return (
          <Card
            size="small"
            className={`${special ? 'cozy-shadow special-card' : evt.isFeatured ? 'cozy-shadow featured-card' : 'cozy-shadow'}${evt._otherStore ? ' other-store' : ''}`}
            style={{
              ...(special
                ? { ...S.eventCard, ...specialVars(evt), border: `2px solid ${special.color}`, background: `linear-gradient(135deg, ${special.color}2e 0%, #2B1A1C 55%)` }
                : evt.isFeatured
                ? { ...S.eventCard, border: '2px solid #FFD700', background: 'linear-gradient(135deg, #3a2a14 0%, #2B1A1C 60%)' }
                : S.eventCard),
            }}
          >
            <div style={S.eventFlex}>
              <div style={{...S.eventInfo, cursor: 'pointer'}} onClick={() => { setSelectedEventDetails(evt); setIsEventDetailsModalOpen(true); }}>
                <div style={{ width: '64px', height: '64px', minWidth: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1012', borderRadius: '8px', border: '1px solid #4A2E33', padding: '4px' }}>
                  <img src={evt.imageUrl || getCategoryImage(evt.category)} alt={evt.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { if (e.target.getAttribute('data-retried') !== 'true') { e.target.setAttribute('data-retried', 'true'); e.target.src = getCategoryImage(evt.category); } else { e.target.src = defaultLogoUrl; } }} />
                </div>
                
                <div style={S.eventDateBox}><CalendarOutlined style={S.eventDateIcon} /><div style={S.eventDateText}>{formatEventDate(evt.date)}</div></div>
                <div>
                  <EventTypeTag evt={evt} />
                  {evt.isFeatured && <Tag icon={<StarFilled />} color="gold" style={{ marginBottom: 5, fontWeight: 'bold' }}>Kiemelt</Tag>}
                  <Tag color={eventColor} style={{...S.eventTag, background: eventColor, color: '#fff', borderColor: eventColor}}>{evt.category || "Egyéb"}</Tag>
                  <OtherStoreTag evt={evt} />
                  <Title level={4} style={S.eventTitle}>{evt.name}</Title>
                  {evt.isOpenAttendance ? null : evt.external_url ? ( rgnEventId(evt.external_url) && evt.rgn?.syncedAt && evt.rgn?.ok !== false ? <><Text type="secondary" style={{color: '#baaaac'}}>Létszám: <Text strong style={{color: '#E0D6C8'}}>{evt.current_players}{evt.rgn.capacity ? ` / ${evt.rgn.capacity}` : ''}</Text></Text>{evt.queue_count > 0 && <Tag color="warning" style={S.queueTag}>Várólistán: {evt.queue_count}</Tag>}<Text type="secondary" style={S.extLinkText}><LinkOutlined style={S.linkIcon}/> Jelentkezés a Riftbound oldalán</Text></> : <Text type="secondary" style={S.extLinkText}><LinkOutlined style={S.linkIcon}/> Külső oldal</Text> ) : ( <><Text type="secondary" style={{color: '#baaaac'}}>Létszám: <Text strong style={{color: '#E0D6C8'}}>{evt.current_players} / {evt.max_players}</Text></Text>{evt.queue_count > 0 && <Tag color="warning" style={S.queueTag}>Várólistán: {evt.queue_count}</Tag>}<AttendeeNames attendees={evt.attendees} max={8} size="small" /></> )}
                </div>
              </div>
              {!evt.isOpenAttendance && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <Button type={btnType} icon={btnIcon} shape="round" size="large" disabled={!evt.is_open && !evt.external_url} onClick={() => initiateJoin(evt)} style={btnType === 'primary' ? S.primaryBtn : { background: '#2B1A1C', color: '#E0D6C8', borderColor: '#4A2E33' }}>
                    {(!evt.is_open && !evt.external_url) ? "Lezárva" : btnText}
                  </Button>
                  {!evt.external_url && <Button type="link" danger size="small" onClick={() => initiateUnsubscribe(evt)}>Leiratkozás</Button>}
                </div>
              )}
            </div>
          </Card>
      );
  };

  const items = tournamentsData || [];
  return (
    <List locale={{ emptyText: <Text style={{ color: '#6b7280', fontStyle: 'italic' }}>Nincs megjeleníthető esemény.</Text> }} dataSource={items} renderItem={(evt) => <List.Item style={S.eventItem}>{renderCard(evt)}</List.Item>} />
  );
};

const MAX_STRIPS_PER_DAY = 3;

// compact: beágyazott (iframe) nézet – nincs dupla cím, keskenyebb rács, alacsonyabb cellák
// weekly: mindig a heti nézet (a nyilvános naptár „Heti” füle); különben gépen havi rács, telefonon heti nézet
export const CalendarView = ({ app, compact = false, weekly = false }) => {
  const { tournaments, setSelectedEventDetails, setIsEventDetailsModalOpen, selectedStore } = app;
  // A naptár csak kliensoldalon renderelődik (betöltés után), így a mai dátum közvetlenül beállítható
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [realToday] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(null); // napi események felugró ablak
  const screens = useBreakpoint(); const isMobile = weekly || screens.md === false;
  
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  let firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  firstDayOfMonth = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; 
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyCells = Array.from({ length: firstDayOfMonth }, (_, i) => i);
  
  const days = ["Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat", "Vasárnap"];
  const months = ["Január", "Február", "Március", "Április", "Május", "Június", "Július", "Augusztus", "Szeptember", "Október", "November", "December"];

  const getEventsForDay = (day) => {
    return (tournaments || []).filter(evt => {
      if (!evt.date) return false;
      const d = new Date(evt.date);
      return d.getFullYear() === currentDate.getFullYear() && d.getMonth() === currentDate.getMonth() && d.getDate() === day;
    }).sort((a,b) => new Date(a.date) - new Date(b.date));
  };

  const getEventTime = (dateStr) => {
      if (!dateStr) return ""; const d = new Date(dateStr); if(isNaN(d)) return "";
      return d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
  };

  const getMonday = (d) => { const date = new Date(d); const day = date.getDay(); const diff = date.getDate() - day + (day === 0 ? -6 : 1); return new Date(date.setDate(diff)); };
  const weekStart = getMonday(currentDate); weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6); weekEnd.setHours(23, 59, 59, 999);
  const formatMobileDateRange = (start, end) => `${start.getFullYear()}. ${String(start.getMonth() + 1).padStart(2, '0')}. ${String(start.getDate()).padStart(2, '0')}. - ${end.getFullYear()}. ${String(end.getMonth() + 1).padStart(2, '0')}. ${String(end.getDate()).padStart(2, '0')}.`;
  
  const eventsByDay = Array(7).fill().map(() => []);
  (tournaments || []).forEach(evt => {
     if(!evt.date) return; const d = new Date(evt.date);
     if(d >= weekStart && d <= weekEnd) { let dayIdx = d.getDay() - 1; if (dayIdx === -1) dayIdx = 6; eventsByDay[dayIdx].push(evt); }
  });
  eventsByDay.forEach(dayEvents => dayEvents.sort((a,b) => new Date(a.date) - new Date(b.date)));

  const prevWeek = () => setCurrentDate(new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000));
  const nextWeek = () => setCurrentDate(new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000));

  return (
    <ConfigProvider theme={tavernTheme}>
      <div>
        {isMobile ? (
          <div className="mobile-weekly-calendar">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', background: '#1a1012', padding: '15px', borderRadius: '16px', border: '1px solid #4A2E33' }}>
              <Button icon={<LeftOutlined />} onClick={prevWeek} style={{ background: '#2B1A1C', color: '#E0D6C8', borderColor: '#4A2E33' }} />
              <div style={{ textAlign: 'center' }}>
                <Text style={{ display: 'block', color: '#baaaac', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Heti nézet</Text>
                <Title level={5} style={{ color: '#E5B15D', margin: 0, fontFamily: 'Georgia, serif' }}>{formatMobileDateRange(weekStart, weekEnd)}</Title>
              </div>
              <Button icon={<RightOutlined />} onClick={nextWeek} style={{ background: '#2B1A1C', color: '#E0D6C8', borderColor: '#4A2E33' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {days.map((dayName, idx) => {
                const dayEvents = eventsByDay[idx];
                const currentDayDate = new Date(weekStart); currentDayDate.setDate(currentDayDate.getDate() + idx);
                const isToday = realToday && realToday.getDate() === currentDayDate.getDate() && realToday.getMonth() === currentDayDate.getMonth() && realToday.getFullYear() === currentDayDate.getFullYear();
                return (
                  <div key={dayName} style={{ background: '#1a1012', padding: '15px', borderRadius: '16px', border: isToday ? '2px solid #E5B15D' : '1px solid #4A2E33', boxShadow: isToday ? '0 4px 15px rgba(229, 177, 93, 0.15)' : 'none' }}>
                    <div style={{ borderBottom: '1px solid #4A2E33', paddingBottom: '10px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <Title level={4} style={{ color: isToday ? '#E5B15D' : '#d8b4e2', margin: 0, fontFamily: 'Georgia, serif' }}>{dayName} {isToday && <Tag color="gold" style={{marginLeft: 10}}>Ma</Tag>}</Title>
                       <Text style={{ color: '#baaaac', fontWeight: 'bold' }}>{`${String(currentDayDate.getMonth() + 1).padStart(2, '0')}. ${String(currentDayDate.getDate()).padStart(2, '0')}.`}</Text>
                    </div>
                    {dayEvents.length > 0 ? ( <EventList tournamentsData={dayEvents} app={app} /> ) : ( <div style={{ textAlign: 'center', padding: '10px 0' }}><Text style={{ color: '#6b7280', fontStyle: 'italic' }}>Nincs kiírt esemény.</Text></div> )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            {!compact && <Title level={2} style={S.sectionTitle}><CalendarOutlined style={S.titleIcon}/> Havi Naptár - {STORES[selectedStore]?.name}</Title>}
            {!compact && <Divider style={S.divider} />}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <Button size="large" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}>&lt; Előző</Button>
              <Title level={2} style={{ margin: 0, color: '#E5B15D', fontFamily: 'Georgia, serif' }}>{months[currentDate.getMonth()]} {currentDate.getFullYear()}</Title>
              <Button size="large" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}>Következő &gt;</Button>
            </div>
            <div style={S.calendarScroll}>
              <div style={compact ? { ...S.calendarGrid, minWidth: 0, gap: '6px' } : S.calendarGrid}>
                {days.map(day => <div key={day} style={S.calHeaderCell}>{day}</div>)}
                {emptyCells.map(i => <div key={`empty-${i}`} />)}
                {daysArray.map(day => {
                  const dayEvents = getEventsForDay(day);
                  const isToday = realToday && realToday.getDate() === day && realToday.getMonth() === currentDate.getMonth() && realToday.getFullYear() === currentDate.getFullYear();
                  return (
                    // Az egész nap cella kattintható (napi események ablak); az eseménysávok a saját részleteiket nyitják meg
                    <div key={day} className="cal-day-cell" role="button" tabIndex={0} title="Napi események" onClick={() => setSelectedDay(day)} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setSelectedDay(day); } }} style={{...S.calDayCell, ...(compact && { minHeight: '120px', padding: '6px' }), borderColor: isToday ? '#E5B15D' : '#4A2E33'}}>
                      <div style={{...S.calDayNum, color: isToday ? '#E5B15D' : '#baaaac'}}><span className="cal-day-num">{day}</span></div>
                      {/* Zsúfolt napokon csak az első néhány esemény fér ki, a többi a napi felugró ablakban látható */}
                      {/* A különleges események (szett megjelenés, expo...) kerülnek előre, így sosem tűnnek el a "+N további" mögött */}
                      {(() => { const ordered = [...dayEvents.filter(isSpecialEvent), ...dayEvents.filter(e => !isSpecialEvent(e))]; return dayEvents.length > MAX_STRIPS_PER_DAY ? ordered.slice(0, MAX_STRIPS_PER_DAY - 1) : ordered; })().map(evt => {
                          const eventColor = getGameColor(evt);
                          const special = isSpecialEvent(evt) ? getEventTypeConfig(evt) : null;
                          return (
                            <div key={String(evt._id || evt.id)} className={[special ? 'special-strip' : evt.isFeatured ? 'featured-strip' : '', evt._otherStore ? 'other-store' : ''].filter(Boolean).join(' ') || undefined} style={{...S.calEventStrip, ...(special ? { ...specialVars(evt), background: special.gradient } : { backgroundColor: eventColor }), color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }} onClick={(e) => { e.stopPropagation(); setSelectedEventDetails(evt); setIsEventDetailsModalOpen(true); }} title={`${getEventTime(evt.date)} ${special ? `${special.label}: ` : ''}${evt.name}${otherStore(evt) ? ` (${otherStore(evt).name})` : ''}`}>
                              {otherStore(evt) ? `${otherStore(evt).icon} ` : ''}{special ? `${special.icon} ${special.short} · ` : evt.isFeatured ? '⭐ ' : ''}{getEventTime(evt.date)} {evt.category || 'Egyéb'}
                            </div>
                          );
                      })}
                      {dayEvents.length > MAX_STRIPS_PER_DAY && (
                        <button type="button" className="cal-more-btn" onClick={(e) => { e.stopPropagation(); setSelectedDay(day); }}>+{dayEvents.length - MAX_STRIPS_PER_DAY + 1} további esemény</button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
        <Modal
          title={selectedDay && (() => { const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedDay); return <span style={{ fontSize: '1.4rem', fontFamily: 'Georgia, serif', color: '#E5B15D' }}>{d.getFullYear()}. {months[d.getMonth()].toLowerCase()} {selectedDay}. – {days[(d.getDay() + 6) % 7]}</span>; })()}
          open={selectedDay !== null}
          onCancel={() => setSelectedDay(null)}
          footer={null}
          width={700}
          closeIcon={<CloseOutlined style={{ color: '#E5B15D' }} />}
        >
          {selectedDay !== null && (() => {
            const dayEvents = getEventsForDay(selectedDay);
            if (dayEvents.length === 0) return <div style={{ textAlign: 'center', padding: '30px 0' }}><Text style={{ color: '#6b7280', fontStyle: 'italic', fontSize: '1.1rem' }}>Nincs kiírt esemény ezen a napon.</Text></div>;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 10 }}>
                {dayEvents.map(evt => {
                  const eventColor = getGameColor(evt);
                  return (
                    <div key={String(evt._id || evt.id)} role="button" tabIndex={0} onClick={() => { setSelectedDay(null); setSelectedEventDetails(evt); setIsEventDetailsModalOpen(true); }} onKeyDown={(e) => { if (e.key === 'Enter') { setSelectedDay(null); setSelectedEventDetails(evt); setIsEventDetailsModalOpen(true); } }} className={[isSpecialEvent(evt) ? 'special-card' : '', evt._otherStore ? 'other-store' : ''].filter(Boolean).join(' ') || undefined} style={{ cursor: 'pointer', ...specialVars(evt), background: isSpecialEvent(evt) ? `linear-gradient(135deg, ${getEventTypeConfig(evt).color}2e 0%, #2B1A1C 55%)` : '#2B1A1C', border: isSpecialEvent(evt) ? `2px solid ${getEventTypeConfig(evt).color}` : evt.isFeatured ? '2px solid #FFD700' : '1px solid #4A2E33', borderLeft: `6px solid ${eventColor}`, borderRadius: 12, padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                        <Text strong style={{ color: '#E5B15D', fontSize: '1.25rem' }}>{getEventTime(evt.date)}</Text>
                        <EventTypeTag evt={evt} />
                        <Tag color={eventColor} style={{ background: eventColor, borderColor: eventColor, color: '#fff', fontSize: '13px', padding: '2px 10px', margin: 0 }}>{evt.category || 'Egyéb'}</Tag>
                        {evt.isFeatured && <Tag icon={<StarFilled />} color="gold" style={{ margin: 0, fontWeight: 'bold' }}>Kiemelt</Tag>}
                        <OtherStoreTag evt={evt} />
                      </div>
                      <Title level={4} style={{ margin: '0 0 6px 0', color: '#E0D6C8' }}>{evt.name}</Title>
                      {evt.description && <Paragraph ellipsis={{ rows: 3 }} style={{ color: '#baaaac', fontSize: '1rem', margin: 0, whiteSpace: 'pre-wrap' }}>{evt.description}</Paragraph>}
                      {!evt.isOpenAttendance && !evt.external_url && (
                        <div style={{ marginTop: 8 }}>
                          <Text style={{ color: '#baaaac' }}>Létszám: <Text strong style={{ color: '#E0D6C8' }}>{evt.current_players} / {evt.max_players}</Text></Text>
                          <AttendeeNames attendees={evt.attendees} max={10} size="small" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </Modal>
        <PublicModals app={app} />
      </div>
    </ConfigProvider>
  );
};

export const SearchResults = ({ app, query }) => {
  const [now] = useState(() => Date.now());
  const events = app.tournaments || [];
  const time = (e) => new Date(e.date).getTime() || 0;
  // Előbb a közelgő események (legkorábbi elöl), utána a múltbeliek (legfrissebb elöl)
  const upcoming = events.filter(e => time(e) >= now).sort((a, b) => time(a) - time(b));
  const past = events.filter(e => time(e) < now).sort((a, b) => time(b) - time(a));
  const sorted = [...upcoming, ...past];

  return (
    <ConfigProvider theme={tavernTheme}>
      <div>
        <Title level={2} style={S.sectionTitle}><SearchOutlined style={S.titleIcon} /> Keresési találatok</Title>
        <Divider style={S.divider} />
        {sorted.length > 0 ? (
          <EventList tournamentsData={sorted} app={app} />
        ) : (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <Text style={{ color: '#6b7280', fontStyle: 'italic' }}>Nincs találat a(z) „{query}” keresésre.</Text>
          </div>
        )}
        <PublicModals app={app} />
      </div>
    </ConfigProvider>
  );
};

// Versenyző gyors hozzáadása a "Jelentkezők" ablakban (helyszíni / telefonos jelentkezés). Az e-mail opcionális.
// Hozzáadás után az űrlap kiürül és a felhasználónév mezőre ugrik, így egymás után többen is gyorsan felvehetők.
export const AddParticipantForm = ({ event, app }) => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const isFull = event.current_players >= event.max_players;

  const submit = async (values) => {
    setSaving(true);
    const ok = await app.adminAddRegistration(event._id || event.id, {
      username: values.username || '',
      name: values.name || '',
      email: values.email || '',
      attended: !!values.attended,
      overCapacity: !!values.overCapacity,
    });
    setSaving(false);
    if (ok) {
      form.resetFields(['username', 'name', 'email']);
      form.getFieldInstance('username')?.focus?.();
    }
  };

  return (
    <div className="bg-[#2B1A1C] rounded-xl border border-[#4A2E33] p-4 mb-4">
      <div style={{ color: '#E5B15D', fontWeight: 'bold', marginBottom: 10 }}><UserAddOutlined /> Versenyző hozzáadása</div>
      <Form form={form} layout="vertical" onFinish={submit} requiredMark={false} initialValues={{ attended: false, overCapacity: false }}>
        <div className="grid gap-x-3 sm:grid-cols-3">
          <Form.Item
            name="username"
            label="Felhasználónév"
            style={{ marginBottom: 8 }}
            dependencies={['name']}
            rules={[({ getFieldValue }) => ({
              validator(_, value) {
                const v = String(value || '').trim();
                if (!v && !String(getFieldValue('name') || '').trim()) return Promise.reject(new Error('Felhasználónév vagy teljes név kell.'));
                if (v && !/^[\p{L}\p{N} ._-]{2,24}$/u.test(v)) return Promise.reject(new Error('2-24 karakter: betű, szám, szóköz, . _ -'));
                return Promise.resolve();
              },
            })]}
          >
            <Input placeholder="Nyilvánosan ez látszik" maxLength={24} autoFocus />
          </Form.Item>
          <Form.Item name="name" label="Teljes név" style={{ marginBottom: 8 }}>
            <Input placeholder="Csak a szervezők látják" maxLength={120} />
          </Form.Item>
          <Form.Item name="email" label="E-mail (nem kötelező)" style={{ marginBottom: 8 }} rules={[{ type: 'email', message: 'Érvénytelen e-mail cím.' }]}>
            <Input placeholder="nev@pelda.hu" />
          </Form.Item>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Space wrap size={16}>
            <Form.Item name="attended" valuePropName="checked" noStyle><Checkbox>Megjelent (helyszíni jelentkezés)</Checkbox></Form.Item>
            {isFull && <Form.Item name="overCapacity" valuePropName="checked" noStyle><Checkbox>Létszámon felül is aktív (nem várólistára)</Checkbox></Form.Item>}
          </Space>
          <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={saving} style={{ color: '#000', fontWeight: 'bold' }}>Hozzáadás</Button>
        </div>
        {isFull && <div style={{ color: '#faad14', fontSize: 12, marginTop: 8 }}>Az esemény betelt ({event.current_players} / {event.max_players}) – a jelölőnégyzet nélkül a versenyző várólistára kerül.</div>}
      </Form>
    </div>
  );
};

// "Újdonságok" ablak az adminoknak (tartalom: lib/changelog.js). Az ownerOnly pontokat csak a tulajdonos látja.
export const ChangelogModal = ({ open, releases, isOwner, onClose }) => (
  <ConfigProvider theme={tavernTheme}>
    <Modal
      open={open}
      onCancel={onClose}
      width={720}
      closeIcon={<CloseOutlined style={{ color: '#E5B15D' }} />}
      title={<span style={{ fontFamily: 'Georgia, serif', fontSize: '1.4rem', color: '#E5B15D' }}>✨ Újdonságok a naptárban</span>}
      footer={[<Button key="ok" type="primary" size="large" style={{ color: '#000', fontWeight: 'bold' }} onClick={onClose}>Rendben, értem</Button>]}
    >
      {(releases || []).map(release => (
        <div key={release.id} style={{ marginTop: 12 }}>
          <Text style={{ color: '#9a8a8c' }}>{release.date} · {release.title}</Text>
          <div className="flex flex-col gap-3 mt-3">
            {release.items.filter(item => isOwner || !item.ownerOnly).map(item => (
              <div key={item.title} className="flex gap-3 bg-[#2B1A1C] rounded-xl border border-[#4A2E33] p-3">
                <div style={{ fontSize: 24, lineHeight: 1.2 }}>{item.icon}</div>
                <div>
                  <div style={{ color: '#E0D6C8', fontWeight: 'bold' }}>
                    {item.title}
                    {item.ownerOnly && <Tag color="purple" style={{ marginLeft: 8 }}>Csak tulajdonos</Tag>}
                  </div>
                  <div style={{ color: '#baaaac', marginTop: 2 }}>{item.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </Modal>
  </ConfigProvider>
);

// Megbízhatóság a check-in előzmények alapján: zöld = mindig eljött, narancs = 1-2 kihagyás, piros = 3+ kihagyás
const ReliabilityTag = ({ stats }) => {
  if (!stats || stats.attended + stats.noShow === 0) return <span style={{ color: '#6b7280', fontSize: 12 }}>Még nincs check-in adat</span>;
  const total = stats.attended + stats.noShow;
  const color = stats.noShow >= 3 ? 'red' : stats.noShow > 0 ? 'orange' : 'green';
  return (
    <Tag color={color} style={{ marginTop: 4 }} title={`Megjelent: ${stats.attended} · Nem jelent meg: ${stats.noShow} (összesen ${total} esemény)`}>
      {stats.noShow > 0 ? `Nem jött el: ${stats.noShow} / ${total} alkalom` : `Mindig eljött (${total} / ${total})`}
    </Tag>
  );
};

// Az admin felület ablakai: esemény létrehozása / szerkesztése / másolása, saját jelszó, jelentkezők, Riftbound-jelentkezők,
// feketelista. Az admin felület (components/AdminApp) használja.
export const AdminModals = ({ app: v }) => {
  const manageableGames = Object.keys(GAME_CONFIG).filter(g => v.canManageGame(g));
  // Előbb az aktív jelentkezők, utána a várólista, mindkettő jelentkezési sorrendben
  const isActiveReg = (r) => r.status === 'Aktív' || r.status === 'Active';
  const currentAttendees = (v.registrations || [])
    .filter(reg => String(reg.tournamentId) === String(v.selectedEventIdForAttendees))
    .sort((a, b) => (isActiveReg(b) - isActiveReg(a)) || (new Date(a.date) - new Date(b.date)));
  const checkedInCount = currentAttendees.filter(r => r.attended === true).length;
  const decklistCount = currentAttendees.filter(r => r.decklist === true).length;
  const attendeesEvent = (v.tournaments || []).find(t => String(t._id || t.id) === String(v.selectedEventIdForAttendees));
  const showDecklist = showsDecklist(attendeesEvent, currentAttendees);

  return (
    <div>
      
      <Modal title={<span style={{ fontFamily: 'Georgia, serif', fontSize: '1.2rem' }}>{v.editingEventId ? "Esemény szerkesztése" : v.isCopyingEvent ? "Esemény másolása" : "Új Esemény Létrehozása"}</span>} open={v.isEventModalOpen} onCancel={() => v.setIsEventModalOpen(false)} onOk={() => v.eventForm.submit()} closeIcon={<CloseOutlined style={{ color: '#E5B15D' }} />} okText={v.editingEventId && v.editingSeries && v.seriesScope && v.seriesScope !== 'one' ? `Mentés (${v.editingSeries[v.seriesScope].length} alkalom)` : 'Mentés'} cancelText="Mégse" okButtonProps={{ style: { color: '#000', fontWeight: 'bold' } }}>
        <Form form={v.eventForm} layout="vertical" onFinish={v.saveEvent} className="mt-4" onValuesChange={(changed, all) => {
          if (('category' in changed || 'store' in changed) && Array.isArray(all.hosts)) {
            const eligible = v.eligibleHosts(all.category, all.store);
            v.eventForm.setFieldsValue({ hosts: all.hosts.filter(id => eligible.some(u => u.id === id)) });
          }
        }}>
          {/* Ismétlődő esemény: melyik alkalmakra vonatkozzon a mentés, illetve a sorozat törlése */}
          {v.editingEventId && v.editingSeries && (
            <div style={{ background: '#2B1A1C', border: '1px solid #4A2E33', borderRadius: 10, padding: '12px 14px', marginBottom: 18 }}>
              <div style={{ color: '#E5B15D', fontWeight: 'bold', marginBottom: 4 }}>Ismétlődő esemény: {v.editingSeries.all.length} jövőbeli alkalom</div>
              <div style={{ color: '#9a8a8c', fontSize: 12, marginBottom: 10 }}>{v.editingSeries.all.map(e => v.formatEventDate(e.date)).slice(0, 8).join(' · ')}{v.editingSeries.all.length > 8 ? ' · …' : ''}</div>
              <Form.Item name="seriesScope" label="A mentés vonatkozzon" initialValue="one" style={{ marginBottom: 6 }}>
                <Radio.Group style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Radio value="one">Csak erre az alkalomra</Radio>
                  <Radio value="following" disabled={v.editingSeries.following.length < 2}>Erre és a következő alkalmakra ({v.editingSeries.following.length} db)</Radio>
                  <Radio value="all">A sorozat összes jövőbeli alkalmára ({v.editingSeries.all.length} db)</Radio>
                </Radio.Group>
              </Form.Item>
              <div style={{ color: '#9a8a8c', fontSize: 12 }}>A többi alkalomnál csak az változik, amit itt átírsz. A napjuk és a külső linkjük megmarad; ha a kezdési időpontot (óra:perc) módosítod, az mindegyiknél változik.</div>
              <div className="flex flex-wrap gap-2" style={{ marginTop: 10 }}>
                {v.editingSeries.following.length > 1 && (
                  <Popconfirm title={`Törlöd ezt és a következő ${v.editingSeries.following.length - 1} alkalmat?`} description="A jelentkezések is törlődnek." onConfirm={() => v.handleDeleteSeries('following')} okText="Törlés" cancelText="Mégse" okButtonProps={{ danger: true }}>
                    <Button size="small" danger>Törlés: ez és a következők</Button>
                  </Popconfirm>
                )}
                <Popconfirm title={`Törlöd a sorozat mind a(z) ${v.editingSeries.all.length} jövőbeli alkalmát?`} description="A jelentkezések is törlődnek." onConfirm={() => v.handleDeleteSeries('all')} okText="Törlés" cancelText="Mégse" okButtonProps={{ danger: true }}>
                  <Button size="small" danger>Az egész sorozat törlése</Button>
                </Popconfirm>
              </div>
            </div>
          )}
          <Form.Item name="name" label="Esemény neve" rules={[{ required: true, message: 'Kötelező!' }]}><Input placeholder="Pl.: Nexus Night BO1" /></Form.Item>
          <Form.Item name="eventType" label="Esemény típusa" initialValue="tournament" extra="A szett megjelenés, az expo és a különleges esemény feltűnőbb, saját megjelenést kap a naptárban. Ha nincs rá jelentkezés, pipáld be a „Kötetlen létszám” opciót.">
            <Select options={Object.entries(EVENT_TYPES).map(([value, t]) => ({ value, label: `${t.icon ? `${t.icon} ` : ''}${t.label}` }))} />
          </Form.Item>
          
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="store" label="Helyszín" rules={[{ required: true, message: 'Kérlek válassz boltot!' }]}>
              <Select placeholder="Válassz boltot..." allowClear>
                {Object.values(STORES).filter(store => v.canManageStore(store.id)).map(store => (<Select.Option key={store.id} value={store.id}>{store.name}</Select.Option>))}
              </Select>
            </Form.Item>
            <Form.Item name="category" label="Kategória (Játék)" rules={[{ required: true, message: 'Kérlek válassz játékot!' }]}>
              <Select placeholder="Válassz játékot..." allowClear>
                {manageableGames.map(game => (<Select.Option key={game} value={game}>{game}</Select.Option>))}
              </Select>
            </Form.Item>
          </div>
          
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.category !== cur.category || prev.store !== cur.store || prev.hosts !== cur.hosts || prev.date !== cur.date}>
            {({ getFieldValue }) => {
              const category = getFieldValue('category');
              const conflicts = findHostConflicts(v.tournaments, { id: v.editingEventId, date: getFieldValue('date'), hosts: getFieldValue('hosts') });
              return (
                <>
                  <Form.Item name="hosts" label="Ki tartja az eseményt? (Opcionális)" extra={category ? 'Csak az adminok látják. Azok közül választhatsz, akik ezt a játékot és boltot kezelhetik.' : 'Előbb válassz játékot.'} style={conflicts.length > 0 ? { marginBottom: 8 } : undefined}>
                    <Select mode="multiple" allowClear disabled={!category} placeholder="Válassz szervezőt..." optionFilterProp="label" options={category ? v.eligibleHosts(category, getFieldValue('store')).map(u => ({ value: u.id, label: u.username })) : []} />
                  </Form.Item>
                  {conflicts.length > 0 && (
                    <div style={{ color: '#faad14', background: '#2b2111', border: '1px solid #594214', borderRadius: 8, padding: '8px 12px', marginBottom: 16, fontSize: 13 }}>
                      <WarningOutlined /> Ütközés: {conflicts.map(({ hostId, event }) => `${v.staffList.find(u => u.id === hostId)?.username || 'Ismeretlen'} ekkor már tartja: ${event.name} (${v.formatEventDate(event.date)})`).join('; ')}
                    </div>
                  )}
                </>
              );
            }}
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.date !== cur.date || prev.store !== cur.store}>
            {({ getFieldValue }) => {
              const hoursWarning = getOpeningHoursWarning(getFieldValue('store'), getFieldValue('date'));
              return (
                <>
                  <Form.Item name="date" label="Dátum és Időpont" rules={[{ required: true, message: 'Kötelező!' }]} style={hoursWarning ? { marginBottom: 8 } : undefined}><Input type="datetime-local" /></Form.Item>
                  {hoursWarning && (
                    <div style={{ color: '#faad14', background: '#2b2111', border: '1px solid #594214', borderRadius: 8, padding: '8px 12px', marginBottom: 16, fontSize: 13 }}>
                      <WarningOutlined /> {hoursWarning}
                    </div>
                  )}
                </>
              );
            }}
          </Form.Item>
          <Form.Item name="isOpenAttendance" valuePropName="checked" extra="Nincs maximum létszám és nem lehet jelentkezni: az esemény csak tájékoztatásul jelenik meg a naptárban."><Checkbox>Kötetlen létszám (nincs jelentkezés)</Checkbox></Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.isOpenAttendance !== cur.isOpenAttendance || prev.max_players !== cur.max_players}>
            {({ getFieldValue }) => {
              const isOpenChecked = !!getFieldValue('isOpenAttendance');
              const isOpenAttendance = resolveAttendance(getFieldValue('max_players'), isOpenChecked).isOpenAttendance;
              return (
                <>
                  <Form.Item name="max_players" label="Max Létszám" extra="0 = kötetlen létszám (nincs jelentkezés)"><Input type="number" min={0} placeholder={isOpenChecked ? 'Kötetlen létszám' : 'Alapértelmezett: 16'} disabled={isOpenChecked} /></Form.Item>
                  <Form.Item name="external_url" label="Külső jelentkezési link (Opcionális)"><Input placeholder="https://..." disabled={isOpenAttendance} /></Form.Item>
                </>
              );
            }}
          </Form.Item>
          <Form.Item name="description" label="Leírás (Opcionális)"><Input.TextArea rows={4} placeholder="További részletek a versenyről..." /></Form.Item>
          <Form.Item name="isFeatured" valuePropName="checked" style={{ marginBottom: 8 }}><Checkbox>Kiemelt verseny/esemény</Checkbox></Form.Item>
          <Form.Item name="decklistEnabled" valuePropName="checked" extra="A „Jelentkezők” ablakban és a mobilos check-inben jelölhető, ki adta le a decklistet."><Checkbox>Decklist leadás jelölése</Checkbox></Form.Item>
        </Form>
      </Modal>

      <Modal title={<span style={{ color: '#E5B15D', fontFamily: 'Georgia, serif' }}>Saját jelszó módosítása</span>} open={v.isOwnPasswordModalOpen} onCancel={() => v.setIsOwnPasswordModalOpen(false)} onOk={() => v.ownPasswordForm.submit()} okText="Mentés" cancelText="Mégse" okButtonProps={{ style: { color: '#000', fontWeight: 'bold' } }} closeIcon={<CloseOutlined style={{ color: '#E5B15D' }} />}>
        <Form form={v.ownPasswordForm} layout="vertical" onFinish={v.submitOwnPasswordChange} className="mt-4">
          <Form.Item name="currentPassword" label="Jelenlegi jelszó" rules={[{ required: true, message: 'Kötelező megadni!' }]}>
            <Input.Password placeholder="Jelenlegi jelszó" />
          </Form.Item>
          <Form.Item name="newPassword" label="Új jelszó" rules={[{ required: true, message: 'Kötelező megadni!', min: 6 }]}>
            <Input.Password placeholder="Legalább 6 karakter" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Új jelszó megerősítése"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Kötelező megadni!' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                  return Promise.reject(new Error('A két jelszó nem egyezik.'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="Ismételd meg az új jelszót" />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title={<span style={{ fontFamily: 'Georgia, serif' }}>Jelentkezők{attendeesEvent ? `: ${attendeesEvent.name}` : ''} · <span style={{ color: '#baaaac', fontSize: '0.9em' }}>{checkedInCount} / {currentAttendees.length} megjelent{showDecklist ? ` · ${decklistCount} decklist` : ''}</span></span>}
        open={v.isAttendeesModalOpen}
        onCancel={() => v.setIsAttendeesModalOpen(false)}
        footer={null}
        width={980}
        destroyOnHidden
        closeIcon={<CloseOutlined style={{ color: '#E5B15D' }} />}
      >
        {attendeesEvent && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <Text style={{ color: '#baaaac' }}>Létszám: <b style={{ color: '#E0D6C8' }}>{attendeesEvent.current_players} / {attendeesEvent.max_players}</b>{attendeesEvent.queue_count > 0 ? ` · várólistán: ${attendeesEvent.queue_count}` : ''}</Text>
              <Space wrap>
                <Button icon={<MobileOutlined />} onClick={() => window.open(checkinPageUrl(attendeesEvent), '_blank', 'noopener')}>Mobilos check-in</Button>
                <Button icon={<EyeOutlined />} onClick={() => window.open(registrationPageUrl(attendeesEvent), '_blank', 'noopener')}>Jelentkezési oldal megnyitása</Button>
              </Space>
            </div>
            <AddParticipantForm key={String(attendeesEvent._id || attendeesEvent.id)} event={attendeesEvent} app={v} />
          </>
        )}
        <p style={{ color: '#9a8a8c', marginTop: 0 }}>Check-in: jelöld, ki jelent meg (✓) és ki nem (✗){showDecklist ? ', illetve ki adta le a decklistet' : ''}. Újrakattintással a jelölés visszavonható. A megbízhatóság az összes eddigi eseményből számolódik.</p>
        <Table dataSource={currentAttendees} rowKey={(record) => record._id || record.id} pagination={false} scroll={{ x: 880 }} columns={[
          { title: 'Felhasználónév / Teljes név', dataIndex: 'name', key: 'name', render: (text, record) => (
              <div>
                {record.username
                  ? <><div style={{ color: '#E5B15D', fontWeight: 'bold' }}>{record.username}</div><div style={{ color: '#E0D6C8' }}>{text}</div></>
                  : <div style={{ color: '#E0D6C8', fontWeight: 'bold' }}>{text}</div>}
                <ReliabilityTag stats={v.attendanceStats?.[record.email]} />
              </div>
          ) },
          { title: 'E-mail', dataIndex: 'email', key: 'email', render: (text, record) => <div><span style={{ color: '#baaaac' }}>{text || '—'}</span>{record.addedBy && <div style={{ color: '#6b7280', fontSize: 12 }}>Felvette: {record.addedBy}</div>}</div> },
          { title: 'Státusz', dataIndex: 'status', key: 'status', render: (s) => <Tag color={s === 'Aktív' || s === 'Active' ? 'green' : 'warning'}>{s}</Tag> },
          { title: 'Megjelent?', key: 'attended', render: (_, record) => {
              const id = record._id || record.id;
              return (
                <Space.Compact>
                  <Button
                    icon={<CheckOutlined />}
                    type={record.attended === true ? 'primary' : 'default'}
                    style={record.attended === true ? { background: '#389e0d', borderColor: '#389e0d', color: '#fff' } : undefined}
                    onClick={() => v.setAttendance(id, record.attended === true ? null : true)}
                    aria-label="Megjelent"
                  />
                  <Button
                    icon={<CloseOutlined />}
                    type={record.attended === false ? 'primary' : 'default'}
                    danger={record.attended === false}
                    onClick={() => v.setAttendance(id, record.attended === false ? null : false)}
                    aria-label="Nem jelent meg"
                  />
                </Space.Compact>
              );
          }},
          ...(showDecklist ? [{ title: 'Decklist?', key: 'decklist', render: (_, record) => {
              const id = record._id || record.id;
              return (
                <Space.Compact>
                  <Button
                    icon={<CheckOutlined />}
                    type={record.decklist === true ? 'primary' : 'default'}
                    style={record.decklist === true ? { background: '#389e0d', borderColor: '#389e0d', color: '#fff' } : undefined}
                    onClick={() => v.setDecklist(id, record.decklist === true ? null : true)}
                    aria-label="Leadta a decklistet"
                    title="Leadta a decklistet"
                  />
                  <Button
                    icon={<CloseOutlined />}
                    type={record.decklist === false ? 'primary' : 'default'}
                    danger={record.decklist === false}
                    onClick={() => v.setDecklist(id, record.decklist === false ? null : false)}
                    aria-label="Nem adta le a decklistet"
                    title="Nem adta le a decklistet"
                  />
                </Space.Compact>
              );
          }}] : []),
          { title: 'Művelet', key: 'action', render: (_, record) => {
              const stats = v.attendanceStats?.[record.email];
              const isBanned = (v.blacklist || []).some(b => b.email === record.email);
              return (
                <Space size={0} wrap>
                  <Popconfirm title="Törlöd a jelentkezést?" onConfirm={() => v.handleRemoveRegistration(record._id || record.id)} okText="Igen" cancelText="Mégse"><Button type="link" danger icon={<DeleteOutlined />}>Törlés</Button></Popconfirm>
                  {v.userRole === 'owner' && record.email && (isBanned
                    ? <Tag color="red" style={{ margin: 0 }}>Tiltva</Tag>
                    : <Popconfirm title="Feketelistára teszed ezt az e-mail címet?" onConfirm={() => v.handleBanEmail({ email: record.email, reason: stats?.noShow ? `Nem jelent meg: ${stats.noShow} / ${stats.attended + stats.noShow} alkalom` : 'Admin tiltás' })} okText="Igen" cancelText="Mégse">
                        <Button type="link" danger icon={<StopOutlined />}>Tiltás</Button>
                      </Popconfirm>)}
                </Space>
              );
          }}
        ]} />
      </Modal>
      <RgnAttendeesModal
        event={(v.tournaments || []).find(t => String(t._id || t.id) === String(v.selectedRgnEventId))}
        data={v.rgnData}
        open={!!v.selectedRgnEventId}
        onClose={() => v.setSelectedRgnEventId(null)}
        onSync={() => v.syncRgn(v.selectedRgnEventId)}
        syncing={v.rgnSyncing}
      />
      <Modal title={<span style={{ color: '#ff4d4f' }}>Feketelista (Tiltott e-mailek)</span>} open={v.isBlacklistModalOpen} onCancel={() => v.setIsBlacklistModalOpen(false)} footer={null} width={800} closeIcon={<CloseOutlined style={{ color: '#ff4d4f' }} />}>
        <Form form={v.blacklistForm} layout="inline" onFinish={v.handleBanEmail} style={{ marginBottom: 20 }}>
          <Form.Item name="email" rules={[{ required: true, type: 'email', message: 'E-mail kötelező!' }]}><Input placeholder="Tiltandó e-mail" style={{ width: 250 }} /></Form.Item>
          <Form.Item name="reason"><Input placeholder="Indoklás (opcionális)" style={{ width: 250 }} /></Form.Item>
          <Form.Item><Button type="primary" danger htmlType="submit">Tiltás</Button></Form.Item>
        </Form>
        <Table dataSource={v.blacklist} rowKey={(record) => record._id} pagination={{ pageSize: 5 }} columns={[
          { title: 'E-mail cím', dataIndex: 'email', render: e => <strong style={{color: '#ff4d4f'}}>{e}</strong> },
          { title: 'Indoklás', dataIndex: 'reason', render: r => <span style={{color: '#baaaac'}}>{r || '-'}</span> },
          { title: 'Dátum', dataIndex: 'date', render: d => <span style={{color: '#baaaac'}}>{new Date(d).toLocaleDateString('hu-HU')}</span> },
          { title: 'Művelet', render: (_, record) => <Popconfirm title="Feloldod a tiltást?" onConfirm={() => v.handleUnbanEmail(record.email)} okText="Igen" cancelText="Mégse"><Button size="small">Feloldás</Button></Popconfirm> }
        ]} />
      </Modal>

    </div>
  );
};
