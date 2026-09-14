"use client";
import React, { useState, useEffect } from "react";
import { Card, Button, Typography, Tag, Space, List, Popconfirm, Table, Modal, Divider, Grid, Form, Input, Select, ConfigProvider, theme } from "antd";
// Hozzáadtuk a LogoutOutlined ikont az importokhoz:
import { TeamOutlined, CalendarOutlined, LinkOutlined, UsergroupAddOutlined, EditOutlined, DeleteOutlined, PlusOutlined, UnorderedListOutlined, SafetyCertificateOutlined, SyncOutlined, CloseOutlined, LogoutOutlined } from "@ant-design/icons";
import { S } from "./styles";
import { GAME_CONFIG } from '@/lib/gameConfig'; 

const { Title, Text, Paragraph } = Typography;
const { useBreakpoint } = Grid;

const tavernTheme = {
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
    Modal: {
      contentBg: '#1a1012',
      headerBg: '#1a1012',
      paddingMD: 24,
    },
    Table: {
      colorBgContainer: '#2B1A1C',
      headerBg: '#1a1012',
      borderColor: '#4A2E33',
    },
    Input: {
      colorBgContainer: '#2B1A1C',
    },
    Select: {
      colorBgContainer: '#2B1A1C',
    }
  }
};

export const getGameConfig = (category) => {
  const fallback = GAME_CONFIG["Egyéb"] || { color: '#6b7280', logo: 'https://cdn-icons-png.flaticon.com/512/6836/6836867.png' };
  if (!category) return fallback;
  
  if (GAME_CONFIG[category]) return GAME_CONFIG[category];

  const catStr = category.toLowerCase();
  for (const key of Object.keys(GAME_CONFIG)) {
    const kStr = key.toLowerCase();
    if ((kStr.includes(catStr) || catStr.includes(kStr)) && key !== "Egyéb") {
      return GAME_CONFIG[key];
    }
  }
  return fallback;
};

export const getCategoryImage = (category) => {
  return getGameConfig(category).logo || 'https://cdn-icons-png.flaticon.com/512/6836/6836867.png';
};

export const PublicModals = ({ app }) => {
  if (!app) return null;
  const { 
    isEventDetailsModalOpen, setIsEventDetailsModalOpen, selectedEventDetails, formatEventDate, initiateJoin,
    isJoinModalOpen, setIsJoinModalOpen, selectedEventToJoin, joinForm, submitJoin,
    isUnsubscribeModalOpen, setIsUnsubscribeModalOpen, unsubscribeForm, submitUnsubscribe
  } = app;

  return (
    <>
      <Modal
        title={<span style={{ fontSize: '1.4rem', fontFamily: 'Georgia, serif' }}>Esemény részletei</span>}
        open={isEventDetailsModalOpen}
        onCancel={() => setIsEventDetailsModalOpen(false)}
        closeIcon={<CloseOutlined style={{ color: '#E5B15D' }} />}
        footer={[
          <Button key="close" onClick={() => setIsEventDetailsModalOpen(false)}>Bezárás</Button>,
          selectedEventDetails?.external_url ? (
            <Button key="ext" type="primary" style={{ color: '#000', fontWeight: 'bold' }} onClick={() => { window.open(selectedEventDetails.external_url, '_blank'); setIsEventDetailsModalOpen(false); }}>
              Tovább a weboldalra
            </Button>
          ) : (
            <Button key="join" type="primary" style={{ color: '#000', fontWeight: 'bold' }} disabled={!selectedEventDetails?.is_open} onClick={() => initiateJoin(selectedEventDetails)}>
              {selectedEventDetails?.is_open ? 'Jelentkezés' : 'Lezárva'}
            </Button>
          )
        ]}
      >
        {selectedEventDetails && (
          <div className="space-y-4 pt-4">
            <div className="flex justify-center mb-6">
              <div className="bg-[#0a0a0a] p-4 rounded-2xl border-2 border-[#4A2E33] shadow-lg">
                <img 
                  src={getCategoryImage(selectedEventDetails.category)} 
                  alt={selectedEventDetails.category} 
                  style={{ width: '120px', height: '120px', objectFit: 'contain' }} 
                />
              </div>
            </div>

            <div className="text-center mb-6">
              <Title level={3} style={{ margin: '0 0 10px 0' }}>{selectedEventDetails.name}</Title>
              <Tag 
                color={getGameConfig(selectedEventDetails.category).color} 
                style={{ 
                  background: getGameConfig(selectedEventDetails.category).color,
                  borderColor: getGameConfig(selectedEventDetails.category).color,
                  color: '#fff', 
                  fontSize: '14px', 
                  padding: '4px 12px' 
                }}
              >
                {selectedEventDetails.category}
              </Tag>
            </div>

            <div className="bg-[#2B1A1C] p-4 rounded-xl border border-[#4A2E33]">
              <p className="mb-2"><strong style={{ color: '#E5B15D' }}>Időpont:</strong> {formatEventDate(selectedEventDetails.date)}</p>
              {!selectedEventDetails.external_url && (
                <p>
                  <strong style={{ color: '#E5B15D' }}>Létszám:</strong> {selectedEventDetails.current_players} / {selectedEventDetails.max_players}
                </p>
              )}
            </div>

            {selectedEventDetails.description && (
              <div className="bg-[#2B1A1C] p-4 rounded-xl border border-[#4A2E33] mt-4">
                <strong style={{ color: '#E5B15D' }}>Leírás:</strong>
                <p style={{ whiteSpace: 'pre-wrap', marginTop: 8, color: '#baaaac' }}>{selectedEventDetails.description}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title={<span style={{ fontSize: '1.2rem', fontFamily: 'Georgia, serif' }}>Jelentkezés: {selectedEventToJoin?.name}</span>}
        open={isJoinModalOpen}
        onCancel={() => setIsJoinModalOpen(false)}
        onOk={() => joinForm.submit()}
        closeIcon={<CloseOutlined style={{ color: '#E5B15D' }} />}
        okText="Jelentkezem"
        cancelText="Mégse"
        okButtonProps={{ style: { color: '#000', fontWeight: 'bold' } }}
      >
        <Form form={joinForm} layout="vertical" onFinish={submitJoin} className="mt-4">
          <Form.Item name="name" label="Neved" rules={[{ required: true, message: 'Kötelező!' }]}>
            <Input placeholder="Pl.: Teszt Elek" />
          </Form.Item>
          <Form.Item name="email" label="E-mail címed" rules={[{ required: true, type: 'email', message: 'Érvényes e-mail kell!' }]}>
            <Input placeholder="pelda@email.com" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={<span style={{ color: '#ff4d4f', fontSize: '1.2rem', fontFamily: 'Georgia, serif' }}>Leiratkozás</span>}
        open={isUnsubscribeModalOpen}
        onCancel={() => setIsUnsubscribeModalOpen(false)}
        onOk={() => unsubscribeForm.submit()}
        closeIcon={<CloseOutlined style={{ color: '#ff4d4f' }} />}
        okText="Leiratkozás"
        cancelText="Mégse"
        okButtonProps={{ danger: true }}
      >
        <Form form={unsubscribeForm} layout="vertical" onFinish={submitUnsubscribe} className="mt-4">
          <p style={{ marginBottom: 15, color: '#baaaac' }}>Add meg az e-mail címed, amivel jelentkeztél a(z) <b style={{color: '#E5B15D'}}>{selectedEventToJoin?.name}</b> eseményre:</p>
          <Form.Item name="email" label="E-mail cím" rules={[{ required: true, type: 'email', message: 'Érvényes e-mail kell!' }]}>
            <Input placeholder="pelda@email.com" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export const EventList = ({ tournamentsData, isAdmin = false, app }) => {
  const { formatEventDate, initiateJoin, setSelectedEventIdForAttendees, setIsAttendeesModalOpen, setEditingEventId, setIsExternalForm, eventForm, setIsEventModalOpen, fetchData, handleDeleteTournament, setSelectedEventDetails, setIsEventDetailsModalOpen } = app;
  return (
    <List dataSource={tournamentsData || []} renderItem={(evt) => {
      const eId = String(evt._id || evt.id);
      const isFull = evt.current_players >= evt.max_players;
      let btnText = "Csatlakozom!"; let btnType = "primary"; let btnIcon = <TeamOutlined />;
      if (evt.external_url) { btnText = "Tovább a weboldalra"; btnType = "default"; btnIcon = <LinkOutlined />; } 
      else if (isFull) { btnText = "Várólista"; btnType = "dashed"; btnIcon = <UsergroupAddOutlined />; }
      
      const eventColor = evt.color || getGameConfig(evt.category).color;

      return (
        <List.Item style={S.eventItem}>
          <Card size="small" className="cozy-shadow" style={S.eventCard}>
            <div style={S.eventFlex}>
              <div style={{...S.eventInfo, cursor: 'pointer'}} onClick={() => { setSelectedEventDetails(evt); setIsEventDetailsModalOpen(true); }}>
                <img src={evt.imageUrl || getCategoryImage(evt.category)} alt={evt.name} style={S.eventImg} />
                <div style={S.eventDateBox}><CalendarOutlined style={S.eventDateIcon} /><div style={S.eventDateText}>{formatEventDate(evt.date)}</div></div>
                <div>
                  <Tag color={eventColor} style={{...S.eventTag, background: eventColor, color: '#fff', borderColor: eventColor}}>
                    {evt.category || "Egyéb"}
                  </Tag>
                  <Title level={4} style={S.eventTitle}>{evt.name}</Title>
                  {evt.external_url ? ( <Text type="secondary" style={S.extLinkText}><LinkOutlined style={S.linkIcon}/> Külső oldal</Text> ) : ( <><Text type="secondary" style={{color: '#baaaac'}}>Létszám: <Text strong style={{color: '#E0D6C8'}}>{evt.current_players} / {evt.max_players}</Text></Text>{evt.queue_count > 0 && <Tag color="warning" style={S.queueTag}>Várólistán: {evt.queue_count}</Tag>}</> )}
                </div>
              </div>
              {!isAdmin ? (
                <Button type={btnType} icon={btnIcon} shape="round" size="large" disabled={!evt.is_open && !evt.external_url} onClick={() => initiateJoin(evt)} style={btnType === 'primary' ? S.primaryBtn : { background: '#2B1A1C', color: '#E0D6C8', borderColor: '#4A2E33' }}>
                  {(!evt.is_open && !evt.external_url) ? "Lezárva" : btnText}
                </Button>
              ) : (
                <Space style={{ flexWrap: 'wrap' }}>
                  {!evt.external_url && <Button type="dashed" icon={<UnorderedListOutlined />} style={{ background: '#2B1A1C', color: '#E0D6C8', borderColor: '#4A2E33' }} onClick={() => { setSelectedEventIdForAttendees(eId); setIsAttendeesModalOpen(true); }}>Jelentkezők</Button>}
                  <Button type="default" icon={<EditOutlined />} style={{ background: '#2B1A1C', color: '#E5B15D', borderColor: '#4A2E33' }} onClick={() => { setEditingEventId(eId); setIsExternalForm(!!evt.external_url); eventForm.setFieldsValue({...evt, max_players: evt.max_players || 8}); setIsEventModalOpen(true); }} />
                  <Button danger={evt.is_open ? true : false} type={evt.is_open ? "primary" : "default"} onClick={() => fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'TOGGLE_GATE', payload: { tournamentId: eId, newState: !evt.is_open }}) }).then(()=>fetchData())}>{evt.is_open ? 'Zárás' : 'Megnyitás'}</Button>
                  <Popconfirm title="Biztosan törlöd?" onConfirm={() => handleDeleteTournament(eId)} okText="Igen" cancelText="Mégse"><Button danger type="text" icon={<DeleteOutlined />} /></Popconfirm>
                </Space>
              )}
            </div>
          </Card>
        </List.Item>
      );
    }} />
  );
};

export const CalendarView = ({ app }) => {
  const { tournaments, setSelectedEventDetails, setIsEventDetailsModalOpen } = app;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [realToday, setRealToday] = useState(null);
  
  useEffect(() => {
    setRealToday(new Date());
    setCurrentDate(new Date());
  }, []);
  
  const screens = useBreakpoint();
  const isMobile = screens.md === false;
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  let firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  firstDayOfMonth = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; 

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyCells = Array.from({ length: firstDayOfMonth }, (_, i) => i);
  const days = ["Hét", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat", "Vasárnap"];
  const months = ["Január", "Február", "Március", "Április", "Május", "Június", "Július", "Augusztus", "Szeptember", "Október", "November", "December"];

  const getEventsForDay = (day) => {
    return (tournaments || []).filter(evt => {
      if (!evt.date) return false;
      const d = new Date(evt.date);
      return d.getFullYear() === currentDate.getFullYear() && d.getMonth() === currentDate.getMonth() && d.getDate() === day;
    }).sort((a,b) => new Date(a.date) - new Date(b.date));
  };

  const getEventTime = (dateStr) => {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      if(isNaN(d)) return "";
      return d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <ConfigProvider theme={tavernTheme}>
      <div>
        <Title level={2} style={S.sectionTitle}><CalendarOutlined style={S.titleIcon}/> Havi Naptár</Title>
        <Divider style={S.divider} />
        {isMobile ? (
          (!tournaments || tournaments.length === 0) ? ( <Paragraph style={S.emptyText}>Nincs esemény.</Paragraph> ) : ( <EventList tournamentsData={tournaments} app={app} /> )
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <Button size="large" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}>&lt; Előző</Button>
              <Title level={2} style={{ margin: 0, color: '#E5B15D', fontFamily: 'Georgia, serif' }}>{months[currentDate.getMonth()]} {currentDate.getFullYear()}</Title>
              <Button size="large" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}>Következő &gt;</Button>
            </div>
            <div style={S.calendarScroll}>
              <div style={S.calendarGrid}>
                {days.map(day => <div key={day} style={S.calHeaderCell}>{day}</div>)}
                {emptyCells.map(i => <div key={`empty-${i}`} />)}
                {daysArray.map(day => {
                  const dayEvents = getEventsForDay(day);
                  const isToday = realToday && realToday.getDate() === day && realToday.getMonth() === currentDate.getMonth() && realToday.getFullYear() === currentDate.getFullYear();
                  
                  return (
                    <div key={day} style={{...S.calDayCell, borderColor: isToday ? '#E5B15D' : '#4A2E33'}}>
                      <div style={{...S.calDayNum, color: isToday ? '#E5B15D' : '#baaaac'}}>{day}</div>
                      {dayEvents.map(evt => {
                          const eventColor = evt.color || getGameConfig(evt.category).color;
                          return (
                            <div 
                              key={String(evt._id || evt.id)} 
                              style={{
                                ...S.calEventStrip, 
                                backgroundColor: eventColor, 
                                color: '#fff', 
                                textShadow: '0 1px 2px rgba(0,0,0,0.5)' 
                              }} 
                              onClick={() => { setSelectedEventDetails(evt); setIsEventDetailsModalOpen(true); }} 
                              title={evt.name}
                            >
                              {getEventTime(evt.date)} {evt.category || 'Egyéb'}
                            </div>
                          );
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        <PublicModals app={app} />
      </div>
    </ConfigProvider>
  );
};

export const AdminEvents = ({ app: v }) => {
  const currentAttendees = (v.registrations || []).filter(reg => String(reg.tournamentId) === String(v.selectedEventIdForAttendees));
  
  return (
    <ConfigProvider theme={tavernTheme}>
      <div>
        <div style={S.tabHeader}>
          <Title level={3} style={S.tabTitle}>Naptár Kezelése</Title>
          <Space style={{ flexWrap: 'wrap' }}>
            <Button 
               type="default" 
               shape="round" 
               style={{ color: '#E5B15D', borderColor: '#E5B15D' }} 
               icon={<SyncOutlined spin={v.isSyncing} />} 
               onClick={v.handleSync}
               loading={v.isSyncing}
            >
              UVS Szinkron
            </Button>
            <Button type="default" shape="round" icon={<SafetyCertificateOutlined />} onClick={() => v.setIsUsersModalOpen(true)}>Szervezők</Button>
            <Button type="primary" shape="round" icon={<PlusOutlined />} style={{ color: '#000', fontWeight: 'bold' }} onClick={() => { v.eventForm.resetFields(); v.setEditingEventId(null); v.setIsExternalForm(false); v.setIsEventModalOpen(true); }}>Új Esemény</Button>
            
            {/* ÚJ KIJELENTKEZÉS GOMB */}
            <Button 
               type="default" 
               shape="round" 
               danger 
               icon={<LogoutOutlined />} 
               onClick={() => { v.handleLogout(); window.location.href = '/'; }}
            >
              Kijelentkezés
            </Button>

          </Space>
        </div>
        
        <EventList tournamentsData={v.tournaments} isAdmin={true} app={v} />
        
        <Modal 
          title={<span style={{ fontFamily: 'Georgia, serif', fontSize: '1.2rem' }}>{v.editingEventId ? "Esemény szerkesztése" : "Új Esemény Létrehozása"}</span>}
          open={v.isEventModalOpen} 
          onCancel={() => v.setIsEventModalOpen(false)} 
          onOk={() => v.eventForm.submit()} 
          closeIcon={<CloseOutlined style={{ color: '#E5B15D' }} />}
          okText="Mentés" 
          cancelText="Mégse"
          okButtonProps={{ style: { color: '#000', fontWeight: 'bold' } }}
        >
          <Form form={v.eventForm} layout="vertical" onFinish={v.saveEvent} className="mt-4">
            <Form.Item name="name" label="Esemény neve" rules={[{ required: true, message: 'Kötelező!' }]}>
              <Input placeholder="Pl.: Nexus Night BO1" />
            </Form.Item>
            <Form.Item name="category" label="Kategória (Játék)" rules={[{ required: true, message: 'Kötelező!' }]}>
              <Select placeholder="Válassz játékot...">
                {Object.keys(GAME_CONFIG).map(game => (
                  <Select.Option key={game} value={game}>{game}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="date" label="Dátum és Időpont" rules={[{ required: true, message: 'Kötelező!' }]}>
              <Input type="datetime-local" />
            </Form.Item>
            <Form.Item name="max_players" label="Max Létszám">
              <Input type="number" placeholder="Alapértelmezett: 16" />
            </Form.Item>
            <Form.Item name="external_url" label="Külső jelentkezési link (Opcionális)">
              <Input placeholder="https://..." />
            </Form.Item>
            <Form.Item name="description" label="Leírás (Opcionális)">
              <Input.TextArea rows={4} placeholder="További részletek a versenyről..." />
            </Form.Item>
          </Form>
        </Modal>

        <Modal title="Szervezős Felhasználók" open={v.isUsersModalOpen} onCancel={() => v.setIsUsersModalOpen(false)} footer={null} width={800} closeIcon={<CloseOutlined style={{ color: '#E5B15D' }} />}>
          <Table dataSource={v.usersList || []} rowKey={(record) => record._id || record.id} pagination={{ pageSize: 5 }} columns={[
            { title: 'Felhasználónév', dataIndex: 'username', render: (text) => <Text strong style={{ color: '#E0D6C8' }}>{text}</Text> },
            { title: 'E-mail', dataIndex: 'email', render: (text) => <span style={{ color: '#baaaac' }}>{text}</span> },
            { title: 'Szerepkör', dataIndex: 'role', render: (role) => {
                // TULAJDONOS SZÖVEG ÁTÍRVA "Admin2"-RE:
                if (role === 'owner') return <Tag color="purple">Admin2</Tag>;
                if (role === 'admin') return <Tag color="orange">Admin</Tag>;
                return <Tag color="green">Játékos</Tag>;
            }},
            { title: 'Művelet', render: (_, record) => {
                if (record.email === v.userEmail || record.role === 'owner') return <Text type="secondary">Védett fiók</Text>;
                
                return (
                  <Space style={{ flexWrap: 'wrap' }}>
                    <Button 
                      type={record.role === 'admin' ? 'default' : 'primary'} 
                      style={record.role === 'admin' ? {} : {color: '#000', fontWeight: 'bold'}} 
                      size="small" 
                      onClick={() => v.toggleUserRole(record)}
                    >
                      {record.role === 'admin' ? 'Visszafokozás' : 'Admin jog'}
                    </Button>

                    {v.userRole === 'owner' && (
                      <>
                        <Button size="small" onClick={() => v.initiatePasswordChange(record)}>Új Jelszó</Button>
                        <Popconfirm title="Biztosan törlöd a felhasználót?" onConfirm={() => v.handleDeleteUser(record._id || record.id)} okText="Igen" cancelText="Mégse">
                          <Button size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      </>
                    )}
                  </Space>
                )
            }}
          ]} />
        </Modal>

        <Modal
          title={<span style={{ color: '#E5B15D', fontFamily: 'Georgia, serif' }}>Jelszó módosítása: {v.selectedUserForPassword?.username}</span>}
          open={v.isPasswordModalOpen}
          onCancel={() => v.setIsPasswordModalOpen(false)}
          onOk={() => v.passwordForm.submit()}
          okText="Mentés"
          cancelText="Mégse"
          okButtonProps={{ style: { color: '#000', fontWeight: 'bold' } }}
          closeIcon={<CloseOutlined style={{ color: '#E5B15D' }} />}
        >
          <Form form={v.passwordForm} layout="vertical" onFinish={v.submitPasswordChange} className="mt-4">
            <Form.Item name="newPassword" label="Új jelszó" rules={[{ required: true, message: 'Kötelező megadni!', min: 6 }]}>
              <Input.Password placeholder="Új jelszó beírása..." />
            </Form.Item>
          </Form>
        </Modal>

        <Modal title="Jelentkezők kezelése" open={v.isAttendeesModalOpen} onCancel={() => v.setIsAttendeesModalOpen(false)} footer={null} width={750} closeIcon={<CloseOutlined style={{ color: '#E5B15D' }} />}>
          <Table dataSource={currentAttendees} rowKey={(record) => record._id || record.id} pagination={false} columns={[
            { title: 'Név', dataIndex: 'name', key: 'name', render: text => <span style={{color: '#E0D6C8'}}>{text}</span> }, 
            { title: 'Email', dataIndex: 'email', key: 'email', render: text => <span style={{color: '#baaaac'}}>{text}</span> }, 
            { title: 'Státusz', dataIndex: 'status', key: 'status', render: (s) => <Tag color={s === 'Aktív' || s === 'Active' ? 'green' : 'warning'}>{s}</Tag> }, 
            { title: 'Művelet', key: 'action', render: (_, record) => (<Popconfirm title="Törlöd?" onConfirm={() => v.handleRemoveRegistration(record._id || record.id)} okText="Igen" cancelText="Mégse"><Button type="link" danger icon={<DeleteOutlined />}>Törlés</Button></Popconfirm>) }
          ]} />
        </Modal>
      </div>
    </ConfigProvider>
  );
};