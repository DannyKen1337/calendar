"use client";
import React, { useState, useEffect } from "react";
import { Card, Button, Typography, Tag, Space, List, Popconfirm, Table, Modal, Divider, Grid, Form, Input, Select, ConfigProvider, theme, Checkbox, Alert } from "antd";
import { TeamOutlined, CalendarOutlined, LinkOutlined, ShareAltOutlined, CheckOutlined, StopOutlined, UsergroupAddOutlined, EditOutlined, DeleteOutlined, PlusOutlined, UnorderedListOutlined, SafetyCertificateOutlined, SyncOutlined, CloseOutlined, LogoutOutlined, EyeOutlined, LeftOutlined, RightOutlined, EnvironmentOutlined, LockOutlined, StarFilled, UserAddOutlined, CopyOutlined, SearchOutlined } from "@ant-design/icons";
import { S } from "./styles";
import { eventMatchesQuery, eventExtraSearchText } from '@/lib/eventSearch';
import { resolveAttendance } from '@/lib/attendance';
import { GAME_CONFIG, getGameConfig, getGameColor } from '@/lib/gameConfig'; 

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

const defaultLogoUrl = 'https://cdn-icons-png.flaticon.com/512/6729/6729800.png';

export const STORES = {
  debrecen: { id: 'debrecen', name: 'Tavern Debrecen', color: '#E5B15D', icon: '🏰' },
  miskolc: { id: 'miskolc', name: 'Tavern Miskolc', color: '#8b5cf6', icon: '⛰️' },
  jatekceh: { id: 'jatekceh', name: 'JátékCéh', color: '#10b981', icon: '🎲' }
};

export { getGameConfig };

export const getCategoryImage = (category) => {
  return getGameConfig(category).logo || defaultLogoUrl;
};

export const StoreSelector = ({ onSelect, embed = false }) => {
  return (
    <ConfigProvider theme={tavernTheme}>
      <main className={`${embed ? 'py-10' : 'min-h-screen'} bg-[#121212] flex flex-col items-center justify-center p-4`}>
        <div className={`text-center ${embed ? 'mb-8' : 'mb-12'}`}>
          <h1 className={`${embed ? 'text-3xl' : 'text-5xl'} font-bold text-[#E5B15D] font-serif mb-4 tracking-wider`}>Közösségi Naptár</h1>
          <p className="text-[#baaaac] text-lg">Kérlek válaszd ki, melyik helyszín eseményeire vagy kíváncsi!</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
          {Object.values(STORES).map(store => (
            <div key={store.id} onClick={() => onSelect(store.id)} className="bg-[#1a1012] border-2 border-[#4A2E33] hover:border-[#E5B15D] rounded-3xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-[#E5B15D]/20 group">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">{store.icon}</div>
              <h2 className="text-2xl font-bold font-serif text-center" style={{ color: store.color }}>{store.name}</h2>
              <div className="mt-6 px-6 py-2 rounded-full border border-gray-700 group-hover:border-[#E5B15D] text-gray-400 group-hover:text-[#E5B15D] transition-colors font-bold uppercase text-sm tracking-widest">Belépés</div>
            </div>
          ))}
        </div>
      </main>
    </ConfigProvider>
  );
};

export const eventShareUrl = (evt) => `${window.location.origin}/esemeny/${encodeURIComponent(String(evt._id || evt.id))}`;

// Esemény megosztása: telefonon a rendszer megosztó menüje, gépen a link vágólapra másolása
export const ShareEventButton = ({ evt, messageApi, ...buttonProps }) => {
  const share = async () => {
    const url = eventShareUrl(evt);
    if (navigator.share) {
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
  return <Button icon={<ShareAltOutlined />} onClick={share} {...buttonProps}>Megosztás</Button>;
};

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
    isJoinModalOpen, setIsJoinModalOpen, selectedEventToJoin, joinForm, submitJoin, isJoining, joinError, joinErrorType, 
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
            </div>
            <div className="bg-[#2B1A1C] p-4 rounded-xl border border-[#4A2E33]">
              <p className="mb-2"><strong style={{ color: '#E5B15D' }}>Időpont:</strong> {formatEventDate(selectedEventDetails.date)}</p>
              
              {!selectedEventDetails.isOpenAttendance && !selectedEventDetails.external_url && ( <p><strong style={{ color: '#E5B15D' }}>Létszám:</strong> {selectedEventDetails.current_players} / {selectedEventDetails.max_players}</p> )}
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

      <Modal title={<span style={{ fontSize: '1.2rem', fontFamily: 'Georgia, serif' }}>Jelentkezés: {selectedEventToJoin?.name}</span>} open={isJoinModalOpen} onCancel={() => setIsJoinModalOpen(false)} onOk={() => joinForm.submit()} confirmLoading={isJoining} closeIcon={<CloseOutlined style={{ color: '#E5B15D' }} />} okText="Jelentkezem" cancelText="Mégse" okButtonProps={{ style: { color: '#000', fontWeight: 'bold' } }}>
        <Form form={joinForm} layout="vertical" onFinish={submitJoin} className="mt-4">
          {joinError && <Alert type={joinErrorType || 'error'} showIcon style={{ marginBottom: 16 }} message={joinError} />}
          <Form.Item name="name" label="Neved" extra={<span style={{ color: '#baaaac' }}>A neved rövidítve (pl. „Teszt E.”) megjelenik a jelentkezők között.</span>} rules={[{ required: true, whitespace: true, message: 'Kötelező!' }]}><Input placeholder="Pl.: Teszt Elek" autoComplete="name" /></Form.Item>
          <Form.Item name="email" label="E-mail címed" normalize={(v) => (typeof v === 'string' ? v.trim() : v)} rules={[{ required: true, type: 'email', message: 'Érvényes e-mail kell!' }]}><Input type="email" inputMode="email" autoComplete="email" placeholder="pelda@email.com" /></Form.Item>
          {/* Adatkezelési tájékoztató (GDPR) */}
          <p style={{ color: '#9a8a8c', fontSize: 12, margin: 0, lineHeight: 1.5 }}>
            A megadott nevet és e-mail címet kizárólag az esemény szervezéséhez (jelentkezés, visszaigazolás, leiratkozás) használjuk, harmadik félnek nem adjuk át. A nevedből csak rövidített forma (pl. „Teszt E.”) jelenik meg nyilvánosan. Az adatokat az esemény után legfeljebb 2 hónappal automatikusan töröljük. A helyszíni megjelenést (megjelent / nem jelent meg) a szervezők rögzíthetik; ezt az e-mail címedhez kötve legfeljebb 1 évig őrizzük, kizárólag a meg nem jelenések kezeléséhez.
            {process.env.NEXT_PUBLIC_PRIVACY_URL && <> <a href={process.env.NEXT_PUBLIC_PRIVACY_URL} target="_blank" rel="noopener noreferrer" style={{ color: '#E5B15D' }}>Adatkezelési tájékoztató</a></>}
          </p>
        </Form>
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
export const EventList = ({ tournamentsData, isAdmin = false, app, grid = false }) => {
  const { formatEventDate, initiateJoin, initiateUnsubscribe, setSelectedEventIdForAttendees, setIsAttendeesModalOpen, setEditingEventId, setIsExternalForm, eventForm, setIsEventModalOpen, handleToggleGate, togglingGateId, handleDeleteTournament, setSelectedEventDetails, setIsEventDetailsModalOpen } = app;
  const renderCard = (evt) => {
      const eId = String(evt._id || evt.id);
      const isFull = evt.current_players >= evt.max_players;
      let btnText = "Csatlakozom!"; let btnType = "primary"; let btnIcon = <TeamOutlined />;
      if (evt.external_url) { btnText = "Tovább a weboldalra"; btnType = "default"; btnIcon = <LinkOutlined />; } 
      else if (isFull) { btnText = "Várólista"; btnType = "dashed"; btnIcon = <UsergroupAddOutlined />; }
      
      const eventColor = getGameColor(evt);
      const storeInfo = STORES[evt.store || 'debrecen'];

      return (
          <Card
            size="small"
            className={evt.isFeatured ? 'cozy-shadow featured-card' : 'cozy-shadow'}
            style={{
              ...(evt.isFeatured
                ? { ...S.eventCard, border: '2px solid #FFD700', background: 'linear-gradient(135deg, #3a2a14 0%, #2B1A1C 60%)' }
                : S.eventCard),
              ...(grid && { height: '100%' }),
            }}
          >
            <div style={S.eventFlex}>
              <div style={{...S.eventInfo, cursor: 'pointer'}} onClick={() => { setSelectedEventDetails(evt); setIsEventDetailsModalOpen(true); }}>
                <div style={{ width: '64px', height: '64px', minWidth: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1012', borderRadius: '8px', border: '1px solid #4A2E33', padding: '4px' }}>
                  <img src={evt.imageUrl || getCategoryImage(evt.category)} alt={evt.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { if (e.target.getAttribute('data-retried') !== 'true') { e.target.setAttribute('data-retried', 'true'); e.target.src = getCategoryImage(evt.category); } else { e.target.src = defaultLogoUrl; } }} />
                </div>
                
                <div style={S.eventDateBox}><CalendarOutlined style={S.eventDateIcon} /><div style={S.eventDateText}>{formatEventDate(evt.date)}</div></div>
                <div>
                  {evt.isFeatured && <Tag icon={<StarFilled />} color="gold" style={{ marginBottom: 5, fontWeight: 'bold' }}>Kiemelt</Tag>}
                  <Tag color={eventColor} style={{...S.eventTag, background: eventColor, color: '#fff', borderColor: eventColor}}>{evt.category || "Egyéb"}</Tag>
                  {isAdmin && <Tag color="default" style={{ borderColor: storeInfo?.color, color: storeInfo?.color, background: 'transparent' }}>{storeInfo?.name}</Tag>}
                  <Title level={4} style={S.eventTitle}>{evt.name}</Title>
                  {evt.isOpenAttendance ? ( isAdmin ? <Tag color="green" style={{ margin: 0 }}>Kötetlen létszám · nincs jelentkezés</Tag> : null ) : evt.external_url ? ( <Text type="secondary" style={S.extLinkText}><LinkOutlined style={S.linkIcon}/> Külső oldal</Text> ) : ( <><Text type="secondary" style={{color: '#baaaac'}}>Létszám: <Text strong style={{color: '#E0D6C8'}}>{evt.current_players} / {evt.max_players}</Text></Text>{evt.queue_count > 0 && <Tag color="warning" style={S.queueTag}>Várólistán: {evt.queue_count}</Tag>}<AttendeeNames attendees={evt.attendees} max={8} size="small" /></> )}
                </div>
              </div>
              {!isAdmin ? (
                evt.isOpenAttendance ? (
                  null
                ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <Button type={btnType} icon={btnIcon} shape="round" size="large" disabled={!evt.is_open && !evt.external_url} onClick={() => initiateJoin(evt)} style={btnType === 'primary' ? S.primaryBtn : { background: '#2B1A1C', color: '#E0D6C8', borderColor: '#4A2E33' }}>
                    {(!evt.is_open && !evt.external_url) ? "Lezárva" : btnText}
                  </Button>
                  {!evt.external_url && <Button type="link" danger size="small" onClick={() => initiateUnsubscribe(evt)}>Leiratkozás</Button>}
                </div>
                )
              ) : !app.canManage(evt) ? (
                // Más játék eseménye: a szervező látja, de nem szerkesztheti és a jelentkezőit sem látja
                <Tag icon={<EyeOutlined />} style={{ background: 'transparent', color: '#baaaac', borderColor: '#4A2E33' }}>Csak megtekintés</Tag>
              ) : (
                <Space style={{ flexWrap: 'wrap' }}>
                  {!evt.external_url && !evt.isOpenAttendance && <Button type="dashed" icon={<UnorderedListOutlined />} style={{ background: '#2B1A1C', color: '#E0D6C8', borderColor: '#4A2E33' }} onClick={() => { setSelectedEventIdForAttendees(eId); setIsAttendeesModalOpen(true); }}>Jelentkezők</Button>}
                  <Button type="default" icon={<EditOutlined />} style={{ background: '#2B1A1C', color: '#E5B15D', borderColor: '#4A2E33' }} onClick={() => { setEditingEventId(eId); setIsExternalForm(!!evt.external_url); eventForm.setFieldsValue({...evt, max_players: evt.max_players || 8, store: evt.store || 'debrecen'}); setIsEventModalOpen(true); }} />
                  {!evt.isOpenAttendance && <Button danger={evt.is_open ? true : false} type={evt.is_open ? "primary" : "default"} loading={togglingGateId === eId} onClick={() => handleToggleGate(eId, !evt.is_open)}>{evt.is_open ? 'Zárás' : 'Megnyitás'}</Button>}
                  <Popconfirm title="Biztosan törlöd?" onConfirm={() => handleDeleteTournament(eId)} okText="Igen" cancelText="Mégse"><Button danger type="text" icon={<DeleteOutlined />} /></Popconfirm>
                </Space>
              )}
            </div>
          </Card>
      );
  };

  const items = tournamentsData || [];
  if (grid) {
    if (items.length === 0) return <Text style={{ color: '#6b7280', fontStyle: 'italic' }}>Nincs megjeleníthető esemény.</Text>;
    return (
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 480px), 1fr))' }}>
        {items.map(evt => <div key={String(evt._id || evt.id)}>{renderCard(evt)}</div>)}
      </div>
    );
  }
  return (
    <List locale={{ emptyText: <Text style={{ color: '#6b7280', fontStyle: 'italic' }}>Nincs megjeleníthető esemény.</Text> }} dataSource={items} renderItem={(evt) => <List.Item style={S.eventItem}>{renderCard(evt)}</List.Item>} />
  );
};

const MAX_STRIPS_PER_DAY = 3;

// compact: beágyazott (iframe) nézet – nincs dupla cím, keskenyebb rács, alacsonyabb cellák
export const CalendarView = ({ app, compact = false }) => {
  const { tournaments, setSelectedEventDetails, setIsEventDetailsModalOpen, selectedStore } = app;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [realToday, setRealToday] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null); // napi események felugró ablak

  useEffect(() => { setRealToday(new Date()); setCurrentDate(new Date()); }, []);
  const screens = useBreakpoint(); const isMobile = screens.md === false;
  
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
                      {(dayEvents.length > MAX_STRIPS_PER_DAY ? dayEvents.slice(0, MAX_STRIPS_PER_DAY - 1) : dayEvents).map(evt => {
                          const eventColor = getGameColor(evt);
                          return (
                            <div key={String(evt._id || evt.id)} className={evt.isFeatured ? 'featured-strip' : undefined} style={{...S.calEventStrip, backgroundColor: eventColor, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }} onClick={(e) => { e.stopPropagation(); setSelectedEventDetails(evt); setIsEventDetailsModalOpen(true); }} title={`${getEventTime(evt.date)} ${evt.name}`}>
                              {evt.isFeatured && '⭐ '}{getEventTime(evt.date)} {evt.category || 'Egyéb'}
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
                    <div key={String(evt._id || evt.id)} role="button" tabIndex={0} onClick={() => { setSelectedDay(null); setSelectedEventDetails(evt); setIsEventDetailsModalOpen(true); }} onKeyDown={(e) => { if (e.key === 'Enter') { setSelectedDay(null); setSelectedEventDetails(evt); setIsEventDetailsModalOpen(true); } }} style={{ cursor: 'pointer', background: '#2B1A1C', border: evt.isFeatured ? '2px solid #FFD700' : '1px solid #4A2E33', borderLeft: `6px solid ${eventColor}`, borderRadius: 12, padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                        <Text strong style={{ color: '#E5B15D', fontSize: '1.25rem' }}>{getEventTime(evt.date)}</Text>
                        <Tag color={eventColor} style={{ background: eventColor, borderColor: eventColor, color: '#fff', fontSize: '13px', padding: '2px 10px', margin: 0 }}>{evt.category || 'Egyéb'}</Tag>
                        {evt.isFeatured && <Tag icon={<StarFilled />} color="gold" style={{ margin: 0, fontWeight: 'bold' }}>Kiemelt</Tag>}
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

// Admin eseménylista napokra bontva: nap fejléc ("Ma", "Holnap", dátum) + az aznapi események kártyarácsban
const AdminDayGroups = ({ events, app, emptyText }) => {
  if (events.length === 0) {
    return <div className="bg-[#1a1012] rounded-xl border border-[#4A2E33] p-8 text-center"><Text style={{ color: '#6b7280', fontStyle: 'italic' }}>{emptyText}</Text></div>;
  }

  const dayKey = (e) => {
    const d = new Date(e.date);
    if (isNaN(d.getTime())) return 'nincs-datum';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const groups = [];
  const byKey = new Map();
  events.forEach(e => {
    const key = dayKey(e);
    if (!byKey.has(key)) { const g = { key, date: new Date(e.date), events: [] }; byKey.set(key, g); groups.push(g); }
    byKey.get(key).events.push(e);
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dayLabel = (g) => {
    if (g.key === 'nincs-datum') return { title: 'Dátum nélkül', badge: null };
    const d = new Date(g.date); d.setHours(0, 0, 0, 0);
    const diffDays = Math.round((d - today) / 86400000);
    const opts = { month: 'long', day: 'numeric', weekday: 'long', ...(d.getFullYear() !== today.getFullYear() && { year: 'numeric' }) };
    const title = d.toLocaleDateString('hu-HU', opts).replace(/^./, c => c.toUpperCase());
    const badge = diffDays === 0 ? 'Ma' : diffDays === 1 ? 'Holnap' : null;
    return { title, badge };
  };

  return groups.map(g => {
    const { title, badge } = dayLabel(g);
    return (
      <div key={g.key}>
        <div className="flex items-center gap-3 mb-3">
          <Title level={4} style={{ margin: 0, color: badge === 'Ma' ? '#E5B15D' : '#E0D6C8', fontFamily: 'Georgia, serif' }}>{title}</Title>
          {badge && <Tag color="gold" style={{ margin: 0 }}>{badge}</Tag>}
          <Text style={{ color: '#9a8a8c' }}>{g.events.length} esemény</Text>
          <div className="flex-1 h-px bg-[#4A2E33]" />
        </div>
        <EventList tournamentsData={g.events} isAdmin={true} app={app} grid />
      </div>
    );
  });
};

export const AdminEvents = ({ app: v }) => {
  const [adminCatFilter, setAdminCatFilter] = useState('Mind');
  const [adminStoreFilter, setAdminStoreFilter] = useState('Mind');
  const [adminSearch, setAdminSearch] = useState('');
  const [showPast, setShowPast] = useState(false);
  const [permUser, setPermUser] = useState(null); // akinek a játék-jogosultságát épp szerkesztjük
  const [permAll, setPermAll] = useState(true);
  const [permCategories, setPermCategories] = useState([]);
  const [permSaving, setPermSaving] = useState(false);

  const openPermissions = (user) => {
    const restricted = Array.isArray(user.allowedCategories);
    setPermUser(user);
    setPermAll(!restricted);
    setPermCategories(restricted ? user.allowedCategories : []);
  };
  const savePermissions = async () => {
    setPermSaving(true);
    const ok = await v.setAdminCategories(permUser._id || permUser.id, permAll ? null : permCategories);
    setPermSaving(false);
    if (ok) setPermUser(null);
  };
  const manageableGames = Object.keys(GAME_CONFIG).filter(g => v.canManageGame(g));

  // Előbb az aktív jelentkezők, utána a várólista, mindkettő jelentkezési sorrendben
  const isActiveReg = (r) => r.status === 'Aktív' || r.status === 'Active';
  const currentAttendees = (v.registrations || [])
    .filter(reg => String(reg.tournamentId) === String(v.selectedEventIdForAttendees))
    .sort((a, b) => (isActiveReg(b) - isActiveReg(a)) || (new Date(a.date) - new Date(b.date)));
  const checkedInCount = currentAttendees.filter(r => r.attended === true).length;
  
  const filteredAndSortedTournaments = (v.tournaments || [])
    .filter(evt => {
      const evtStore = evt.store || 'debrecen';
      const isStoreMatch = adminStoreFilter === 'Mind' || evtStore === adminStoreFilter;
      const isCatMatch = adminCatFilter === 'Mind' || evt.category === adminCatFilter;
      return isStoreMatch && isCatMatch && eventMatchesQuery(evt, adminSearch, eventExtraSearchText(evt, STORES[evtStore]?.name));
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Közelgő (ma vagy később) és múltbeli események külön; a múltbeliek alapból rejtve, a legfrissebb elöl
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const evtTime = (e) => new Date(e.date).getTime();
  const upcomingEvents = filteredAndSortedTournaments.filter(e => !(evtTime(e) < startOfToday.getTime()));
  const pastEvents = filteredAndSortedTournaments.filter(e => evtTime(e) < startOfToday.getTime()).reverse();

  const stats = {
    events: upcomingEvents.length,
    players: upcomingEvents.reduce((sum, e) => sum + (e.isOpenAttendance || e.external_url ? 0 : (e.current_players || 0)), 0),
    queue: upcomingEvents.reduce((sum, e) => sum + (e.queue_count || 0), 0),
    closed: upcomingEvents.filter(e => !e.is_open && !e.isOpenAttendance && !e.external_url).length,
  };

  const openNewEvent = () => {
    v.eventForm.resetFields();
    v.eventForm.setFieldsValue({ store: adminStoreFilter !== 'Mind' ? adminStoreFilter : undefined });
    v.setEditingEventId(null);
    v.setIsExternalForm(false);
    v.setIsEventModalOpen(true);
  };

  const handleFilteredExport = () => {
    const today = new Date(); today.setHours(0, 0, 0, 0); 
    const exportTournaments = (v.tournaments || []).filter(evt => {
      const evtDate = new Date(evt.date); const isFuture = evtDate >= today;
      const evtStore = evt.store || 'debrecen';
      const isStoreMatch = adminStoreFilter === 'Mind' || evtStore === adminStoreFilter;
      const matchesFilter = adminCatFilter === 'Mind' || evt.category === adminCatFilter;
      return isFuture && matchesFilter && isStoreMatch;
    });

    const exportedIds = exportTournaments.map(t => String(t._id || t.id));
    const exportRegistrations = (v.registrations || []).filter(r => exportedIds.includes(String(r.tournamentId)));
    const dbDump = { exportDate: new Date(), tournaments: exportTournaments, registrations: exportRegistrations, users: v.usersList || [], logs: v.logs || [], blacklist: v.blacklist || [] };
    const blob = new Blob([JSON.stringify(dbDump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url;
    const filterName = adminCatFilter === 'Mind' ? 'osszes' : adminCatFilter.toLowerCase().replace(/\s+/g, '_');
    a.download = `tavern_naptar_${adminStoreFilter}_${filterName}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const panel = "bg-[#1a1012] p-4 rounded-xl border border-[#4A2E33]";
  const panelTitle = { color: '#E5B15D', margin: '0 0 12px 0', fontFamily: 'Georgia, serif' };
  const sideBtn = { color: '#E0D6C8', borderColor: '#4A2E33', background: '#2B1A1C' };

  return (
    <ConfigProvider theme={tavernTheme}>
      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)] items-start">

        {/* OLDALSÁV: műveletek, szűrők, áttekintés, tulajdonosi eszközök (széles képernyőn görgetéskor is látszik) */}
        <aside className="flex flex-col gap-4 xl:sticky xl:top-4">
          <div className={panel}>
            <Button type="primary" block size="large" icon={<PlusOutlined />} style={{ color: '#000', fontWeight: 'bold', marginBottom: 8 }} onClick={openNewEvent}>Új esemény</Button>
            <div className="grid grid-cols-2 gap-2">
              <Button block icon={<CalendarOutlined />} style={{ ...sideBtn, color: '#E5B15D' }} onClick={() => window.location.href = '/admin/generator'}>Generátor</Button>
              <Button block icon={<EyeOutlined />} style={sideBtn} onClick={() => window.open('/', '_blank', 'noopener')}>Naptár</Button>
            </div>
          </div>

          <div className={panel}>
            <Title level={5} style={panelTitle}><SearchOutlined /> Szűrés</Title>
            <div className="flex flex-col gap-2">
              <Input allowClear prefix={<SearchOutlined style={{ color: '#E5B15D' }} />} placeholder="Név, játék, dátum, helyszín..." value={adminSearch} onChange={(e) => setAdminSearch(e.target.value)} />
              <Select value={adminStoreFilter} onChange={setAdminStoreFilter} prefix={<EnvironmentOutlined style={{ color: '#E5B15D' }} />} style={{ width: '100%' }}>
                <Select.Option value="Mind">Összes helyszín</Select.Option>
                {Object.values(STORES).map(s => <Select.Option key={s.id} value={s.id}>{s.name}</Select.Option>)}
              </Select>
              <Select value={adminCatFilter} onChange={setAdminCatFilter} style={{ width: '100%' }}>
                <Select.Option value="Mind">Minden játék</Select.Option>
                {Object.keys(GAME_CONFIG).map(g => <Select.Option key={g} value={g}>{g}</Select.Option>)}
              </Select>
              <Checkbox checked={showPast} onChange={(e) => setShowPast(e.target.checked)} style={{ marginTop: 4 }}>Múltbeli események mutatása ({pastEvents.length})</Checkbox>
            </div>
          </div>

          <div className={panel}>
            <Title level={5} style={panelTitle}>Közelgő események</Title>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['Esemény', stats.events, '#E5B15D'],
                ['Jelentkező', stats.players, '#E0D6C8'],
                ['Várólistán', stats.queue, '#faad14'],
                ['Lezárva', stats.closed, '#ff7875'],
              ].map(([label, value, color]) => (
                <div key={label} className="bg-[#2B1A1C] rounded-lg border border-[#4A2E33] px-3 py-2">
                  <div style={{ color, fontSize: 22, fontWeight: 'bold', lineHeight: 1.2 }}>{value}</div>
                  <div style={{ color: '#9a8a8c', fontSize: 12 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {v.userRole === 'owner' && (
            <div className="bg-[#1a1012] p-4 rounded-xl border-2 border-purple-900">
              <Title level={5} style={{ ...panelTitle, color: '#d8b4e2' }}>👑 Tulajdonosi eszközök</Title>
              <div className="flex items-center justify-between gap-2 bg-[#2B1A1C] px-3 py-2 rounded-lg border border-[#4A2E33] mb-2">
                <strong className={v.isMaintenance ? "text-red-500" : "text-green-500"}>Karbantartás</strong>
                <Popconfirm title={`Biztosan ${v.isMaintenance ? 'kikapcsolod' : 'bekapcsolod'} a karbantartást?`} onConfirm={() => v.toggleMaintenance(!v.isMaintenance)} okText="Igen" cancelText="Mégse">
                  <Button danger={v.isMaintenance} type={v.isMaintenance ? "primary" : "default"} size="small">{v.isMaintenance ? "BE" : "KI"}</Button>
                </Popconfirm>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button block icon={<SafetyCertificateOutlined />} style={sideBtn} onClick={() => v.setIsUsersModalOpen(true)}>Szervezők</Button>
                <Button block icon={<UserAddOutlined />} style={{ ...sideBtn, color: '#E5B15D' }} onClick={() => { v.createUserForm.resetFields(); v.setIsCreateUserModalOpen(true); }}>Új fiók</Button>
                <Button block style={sideBtn} onClick={() => v.setIsLogModalOpen(true)}>Napló</Button>
                <Button block danger style={{ background: '#2B1A1C' }} onClick={() => v.setIsBlacklistModalOpen(true)}>Feketelista</Button>
              </div>
              <Divider style={{ ...S.divider, margin: '12px 0' }} />
              <div className="flex flex-col gap-2">
                <Button block style={sideBtn} onClick={v.handleExportDB}>💾 Teljes adatbázis mentés</Button>
                <Button block style={sideBtn} onClick={handleFilteredExport} title="Csak a jövőbeli, a szűrőknek megfelelő események és jelentkezőik">📤 Szűrt események exportja</Button>
                <Popconfirm title="Biztosan törlöd a 2 hónapnál régebbi eseményeket és jelentkezőiket?" onConfirm={v.handleCleanupOldEvents} okText="Igen" cancelText="Mégse">
                  <Button block style={{ background: '#7f1d1d', borderColor: '#7f1d1d', color: '#fff' }}>🧹 Régi események törlése</Button>
                </Popconfirm>
              </div>
            </div>
          )}
        </aside>

        {/* ESEMÉNYEK: napokra csoportosítva, kártyarácsban */}
        <section className="min-w-0 flex flex-col gap-6">
          <AdminDayGroups events={upcomingEvents} app={v} emptyText={adminSearch || adminCatFilter !== 'Mind' || adminStoreFilter !== 'Mind' ? 'Nincs a szűrőknek megfelelő közelgő esemény.' : 'Nincs közelgő esemény.'} />
          {showPast && (
            <>
              <Divider style={{ ...S.divider, margin: 0 }}><span style={{ color: '#9a8a8c' }}>Múltbeli események</span></Divider>
              <AdminDayGroups events={pastEvents} app={v} emptyText="Nincs múltbeli esemény." />
            </>
          )}
        </section>
      </div>
      <div>
        
        <Modal title={<span style={{ fontFamily: 'Georgia, serif', fontSize: '1.2rem' }}>{v.editingEventId ? "Esemény szerkesztése" : "Új Esemény Létrehozása"}</span>} open={v.isEventModalOpen} onCancel={() => v.setIsEventModalOpen(false)} onOk={() => v.eventForm.submit()} closeIcon={<CloseOutlined style={{ color: '#E5B15D' }} />} okText="Mentés" cancelText="Mégse" okButtonProps={{ style: { color: '#000', fontWeight: 'bold' } }}>
          <Form form={v.eventForm} layout="vertical" onFinish={v.saveEvent} className="mt-4">
            <Form.Item name="name" label="Esemény neve" rules={[{ required: true, message: 'Kötelező!' }]}><Input placeholder="Pl.: Nexus Night BO1" /></Form.Item>
            
            <div className="grid grid-cols-2 gap-4">
              <Form.Item name="store" label="Helyszín" rules={[{ required: true, message: 'Kérlek válassz boltot!' }]}>
                <Select placeholder="Válassz boltot..." allowClear>
                  {Object.values(STORES).map(store => (<Select.Option key={store.id} value={store.id}>{store.name}</Select.Option>))}
                </Select>
              </Form.Item>
              <Form.Item name="category" label="Kategória (Játék)" rules={[{ required: true, message: 'Kérlek válassz játékot!' }]}>
                <Select placeholder="Válassz játékot..." allowClear>
                  {manageableGames.map(game => (<Select.Option key={game} value={game}>{game}</Select.Option>))}
                </Select>
              </Form.Item>
            </div>
            
            <Form.Item name="date" label="Dátum és Időpont" rules={[{ required: true, message: 'Kötelező!' }]}><Input type="datetime-local" /></Form.Item>
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
            <Form.Item name="isFeatured" valuePropName="checked"><Checkbox>Kiemelt verseny/esemény</Checkbox></Form.Item>
          </Form>
        </Modal>

        <Modal
          title={<span style={{ color: '#E5B15D', fontFamily: 'Georgia, serif' }}>{v.createdCredentials ? 'Felhasználó létrehozva' : 'Új felhasználó létrehozása'}</span>}
          open={v.isCreateUserModalOpen}
          onCancel={v.closeCreateUserModal}
          onOk={() => v.createUserForm.submit()}
          okText="Létrehozás"
          cancelText="Mégse"
          okButtonProps={{ loading: v.isCreatingUser, style: { color: '#000', fontWeight: 'bold' } }}
          footer={v.createdCredentials ? [<Button key="done" type="primary" style={{ color: '#000', fontWeight: 'bold' }} onClick={v.closeCreateUserModal}>Kész</Button>] : undefined}
          closeIcon={<CloseOutlined style={{ color: '#E5B15D' }} />}
          forceRender
        >
          <Form form={v.createUserForm} layout="vertical" onFinish={v.submitCreateUser} className="mt-4" initialValues={{ role: 'admin' }} style={{ display: v.createdCredentials ? 'none' : 'block' }}>
            <p style={{ color: '#baaaac', marginBottom: 16 }}>A rendszer egy ideiglenes, egyszer használatos jelszót generál. Az első belépéskor a felhasználónak saját jelszót kell választania.</p>
            <Form.Item name="username" label="Felhasználónév" rules={[{ required: true, message: 'Kötelező!' }, { pattern: /^[\p{L}\p{N}._-]{3,32}$/u, message: '3-32 karakter: betű, szám, pont, aláhúzás, kötőjel.' }]}>
              <Input placeholder="Pl.: tavern_szervezo" />
            </Form.Item>
            <Form.Item name="email" label="E-mail cím" rules={[{ required: true, type: 'email', message: 'Érvényes e-mail kell!' }]}>
              <Input placeholder="pelda@email.com" />
            </Form.Item>
            <Form.Item name="role" label="Szerep">
              <Select>
                <Select.Option value="admin">Admin (szervező)</Select.Option>
                <Select.Option value="customer">Játékos</Select.Option>
              </Select>
            </Form.Item>
          </Form>
          {v.createdCredentials && (
            <div className="space-y-4 pt-2">
              <div className="bg-[#2B1A1C] p-4 rounded-xl border border-[#4A2E33]">
                <p className="mb-2"><strong style={{ color: '#E5B15D' }}>Felhasználónév:</strong> {v.createdCredentials.username}</p>
                <p className="mb-3"><strong style={{ color: '#E5B15D' }}>E-mail:</strong> {v.createdCredentials.email}</p>
                <strong style={{ color: '#E5B15D' }}>Ideiglenes jelszó:</strong>
                <div className="flex items-center gap-3 mt-2">
                  <code style={{ background: '#0a0a0a', border: '1px solid #4A2E33', borderRadius: 8, padding: '8px 14px', fontSize: '1.25rem', letterSpacing: '2px', color: '#E0D6C8', userSelect: 'all' }}>{v.createdCredentials.tempPassword}</code>
                  <Button icon={<CopyOutlined />} onClick={() => { if (navigator.clipboard) { navigator.clipboard.writeText(v.createdCredentials.tempPassword).then(() => v.messageApi.success('Jelszó a vágólapra másolva!'), () => v.messageApi.error('A másolás nem sikerült, jelöld ki kézzel.')); } else { v.messageApi.error('A másolás nem támogatott, jelöld ki kézzel.'); } }}>Másolás</Button>
                </div>
              </div>
              <p style={{ color: '#ff7875' }}><strong>Ez a jelszó csak most látható</strong>, később nem kérhető le. Add át a felhasználónak biztonságos módon.</p>
              <p style={{ color: '#baaaac' }}>Egyszer használható, {v.createdCredentials.expiresAt ? `${new Date(v.createdCredentials.expiresAt).toLocaleDateString('hu-HU')}-ig érvényes` : '7 napig érvényes'}. Az /admin oldalon belépve a felhasználónak azonnal új jelszót kell megadnia.</p>
            </div>
          )}
        </Modal>
        <Modal title="Szervezős Felhasználók" open={v.isUsersModalOpen} onCancel={() => v.setIsUsersModalOpen(false)} footer={null} width={800} closeIcon={<CloseOutlined style={{ color: '#E5B15D' }} />}>
          <Table dataSource={v.usersList || []} rowKey={(record) => record._id || record.id} pagination={{ pageSize: 5 }} columns={[
            { title: 'Név', dataIndex: 'username', render: (text, record) => <Space size={6} wrap><Text strong style={{ color: '#E0D6C8' }}>{text}</Text>{record.mustChangePassword && <Tag color="blue">Ideiglenes jelszó</Tag>}</Space> },
            { title: 'E-mail', dataIndex: 'email', render: (text) => <span style={{ color: '#baaaac' }}>{text}</span> },
            { title: 'Szerep', dataIndex: 'role', render: (role) => { if (role === 'owner') return <Tag color="purple">Admin2</Tag>; if (role === 'admin') return <Tag color="orange">Admin</Tag>; return <Tag color="green">Játékos</Tag>; }},
            { title: 'Kezelt játékok', render: (_, record) => {
                if (record.role === 'owner') return <Tag color="purple">Minden</Tag>;
                if (record.role !== 'admin') return <Text type="secondary">—</Text>;
                const games = Array.isArray(record.allowedCategories) ? record.allowedCategories : null;
                return (
                  <Space size={4} wrap>
                    {games === null ? <Tag color="gold">Minden játék</Tag> : games.length === 0 ? <Tag color="red">Egyik sem</Tag> : games.map(g => <Tag key={g} style={{ background: getGameColor({ category: g }), borderColor: getGameColor({ category: g }), color: '#fff', margin: 0 }}>{g}</Tag>)}
                    {v.userRole === 'owner' && <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openPermissions(record)}>Módosítás</Button>}
                  </Space>
                );
            }},
            { title: 'Művelet', render: (_, record) => {
                if (record.email === v.userEmail || record.role === 'owner') return <Text type="secondary">Védett fiók</Text>;
                if (v.userRole !== 'owner') return <Text type="secondary">—</Text>;
                return (
                  <Space style={{ flexWrap: 'wrap' }}>
                    <Button type={record.role === 'admin' ? 'default' : 'primary'} style={record.role === 'admin' ? {} : {color: '#000', fontWeight: 'bold'}} size="small" onClick={() => v.toggleUserRole(record)}>{record.role === 'admin' ? 'Visszafokozás' : 'Admin jog'}</Button>
                    <Button size="small" onClick={() => v.initiatePasswordChange(record)}>Új Jelszó</Button>
                    <Popconfirm title="Biztosan törlöd a felhasználót?" onConfirm={() => v.handleDeleteUser(record._id || record.id)} okText="Igen" cancelText="Mégse"><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
                  </Space>
                )
            }}
          ]} />
        </Modal>
        <Modal
          title={<span style={{ color: '#E5B15D', fontFamily: 'Georgia, serif' }}>Kezelt játékok: {permUser?.username}</span>}
          open={!!permUser}
          onCancel={() => setPermUser(null)}
          onOk={savePermissions}
          okText="Mentés"
          cancelText="Mégse"
          okButtonProps={{ loading: permSaving, disabled: !permAll && permCategories.length === 0, style: { color: '#000', fontWeight: 'bold' } }}
          closeIcon={<CloseOutlined style={{ color: '#E5B15D' }} />}
        >
          <p style={{ color: '#baaaac' }}>A szervező minden eseményt lát a naptárban, de csak a kiválasztott játékok eseményeit hozhatja létre, szerkesztheti, nyithatja/zárhatja és törölheti, és csak ezek jelentkezőit látja.</p>
          <Checkbox checked={permAll} onChange={(e) => setPermAll(e.target.checked)} style={{ marginBottom: 12 }}>Minden játékot kezelhet</Checkbox>
          {!permAll && (
            <Checkbox.Group value={permCategories} onChange={setPermCategories} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
              {Object.keys(GAME_CONFIG).map(g => <Checkbox key={g} value={g}>{g}</Checkbox>)}
            </Checkbox.Group>
          )}
          {!permAll && permCategories.length === 0 && <p style={{ color: '#ff7875', marginTop: 12 }}>Válassz legalább egy játékot (vagy fokozd vissza a felhasználót játékossá).</p>}
        </Modal>
        <Modal title={<span style={{ color: '#E5B15D', fontFamily: 'Georgia, serif' }}>Jelszó módosítása: {v.selectedUserForPassword?.username}</span>} open={v.isPasswordModalOpen} onCancel={() => v.setIsPasswordModalOpen(false)} onOk={() => v.passwordForm.submit()} okText="Mentés" cancelText="Mégse" okButtonProps={{ style: { color: '#000', fontWeight: 'bold' } }} closeIcon={<CloseOutlined style={{ color: '#E5B15D' }} />}>
          <Form form={v.passwordForm} layout="vertical" onFinish={v.submitPasswordChange} className="mt-4"><Form.Item name="newPassword" label="Új jelszó" rules={[{ required: true, message: 'Kötelező megadni!', min: 6 }]}><Input.Password placeholder="Új jelszó beírása..." /></Form.Item></Form>
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
          title={<span style={{ fontFamily: 'Georgia, serif' }}>Jelentkezők · <span style={{ color: '#baaaac', fontSize: '0.9em' }}>{checkedInCount} / {currentAttendees.length} megjelent</span></span>}
          open={v.isAttendeesModalOpen}
          onCancel={() => v.setIsAttendeesModalOpen(false)}
          footer={null}
          width={980}
          closeIcon={<CloseOutlined style={{ color: '#E5B15D' }} />}
        >
          <p style={{ color: '#9a8a8c', marginTop: 0 }}>Check-in: jelöld, ki jelent meg (✓) és ki nem (✗). Újrakattintással a jelölés visszavonható. A megbízhatóság az összes eddigi eseményből számolódik.</p>
          <Table dataSource={currentAttendees} rowKey={(record) => record._id || record.id} pagination={false} scroll={{ x: 760 }} columns={[
            { title: 'Név', dataIndex: 'name', key: 'name', render: (text, record) => <div><div style={{ color: '#E0D6C8', fontWeight: 'bold' }}>{text}</div><ReliabilityTag stats={v.attendanceStats?.[record.email]} /></div> },
            { title: 'E-mail', dataIndex: 'email', key: 'email', render: text => <span style={{ color: '#baaaac' }}>{text}</span> },
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
            { title: 'Művelet', key: 'action', render: (_, record) => {
                const stats = v.attendanceStats?.[record.email];
                const isBanned = (v.blacklist || []).some(b => b.email === record.email);
                return (
                  <Space size={0} wrap>
                    <Popconfirm title="Törlöd a jelentkezést?" onConfirm={() => v.handleRemoveRegistration(record._id || record.id)} okText="Igen" cancelText="Mégse"><Button type="link" danger icon={<DeleteOutlined />}>Törlés</Button></Popconfirm>
                    {v.userRole === 'owner' && (isBanned
                      ? <Tag color="red" style={{ margin: 0 }}>Tiltva</Tag>
                      : <Popconfirm title="Feketelistára teszed ezt az e-mail címet?" onConfirm={() => v.handleBanEmail({ email: record.email, reason: stats?.noShow ? `Nem jelent meg: ${stats.noShow} / ${stats.attended + stats.noShow} alkalom` : 'Admin tiltás' })} okText="Igen" cancelText="Mégse">
                          <Button type="link" danger icon={<StopOutlined />}>Tiltás</Button>
                        </Popconfirm>)}
                  </Space>
                );
            }}
          ]} />
        </Modal>
        <Modal title={<span style={{ color: '#E5B15D' }}>Tevékenységnapló (Audit Log)</span>} open={v.isLogModalOpen} onCancel={() => v.setIsLogModalOpen(false)} footer={null} width={900} closeIcon={<CloseOutlined style={{ color: '#E5B15D' }} />}>
          <Table dataSource={v.logs} rowKey={(record) => record._id} pagination={{ pageSize: 8 }} columns={[
            { title: 'Dátum', dataIndex: 'date', render: d => <span style={{color: '#baaaac'}}>{new Date(d).toLocaleString('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span> },
            { title: 'Szervező', dataIndex: 'adminName', render: n => <Tag color="purple">{n}</Tag> },
            { title: 'Művelet', dataIndex: 'action', render: a => <strong style={{color: '#E5B15D'}}>{a}</strong> },
            { title: 'Részletek', dataIndex: 'details', render: text => <span style={{color: '#E0D6C8'}}>{text}</span> }
          ]} />
        </Modal>
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
    </ConfigProvider>
  );
};