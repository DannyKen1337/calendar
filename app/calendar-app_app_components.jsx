
"use client";
import React, { useState } from "react";
import { Card, Button, Typography, Row, Col, Tag, Space, List, Input, Popconfirm, InputNumber, Table, Modal, Form, Select, Upload, Switch, Divider, Grid } from "antd";
import { TeamOutlined, CalendarOutlined, LinkOutlined, UsergroupAddOutlined, EditOutlined, DeleteOutlined, PlusOutlined, UploadOutlined, UnorderedListOutlined } from "@ant-design/icons";
import { S } from "./styles";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { useBreakpoint } = Grid;

export const getCategoryImage = (category) => {
  switch(category) {
    case 'Riftbound': return 'https://wiki.leagueoflegends.com/en-us/images/RB_riftbound_icon.svg?a702a';
    case 'Pokémon': return 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/International_Pok%C3%A9mon_logo.svg/3840px-International_Pok%C3%A9mon_logo.svg.png';
    case 'Lorcana': return 'https://static.wixstatic.com/media/91be11_f9288d8f9cea4f0eaf0c28960445cecf~mv2.png/v1/crop/x_60,y_0,w_624,h_355/fill/w_660,h_376,fp_0.50_0.50,lg_1,q_85,enc_avif,quality_auto/Disney%20Lorcana_TCG_Logo%20transparent.png';
    case 'Magic': return 'https://1000logos.net/wp-content/uploads/2022/10/Magic-The-Gathering-logo.png';
    case 'Yu-Gi-Oh!': return 'https://upload.wikimedia.org/wikipedia/commons/2/21/Yu-Gi-Oh%21.png'; 
    case 'One Piece': return 'https://static.wixstatic.com/media/57a197_e334385962ac4203abe6390f3b6ff4c6~mv2.png/v1/fill/w_560,h_314,al_c,q_85,usm_0.66_1.00_0.01,enc_auto/ONE%20PIECE%20LOGO.png';
    default: return 'https://cdn-icons-png.flaticon.com/512/6836/6836867.png'; 
  }
};

export const EventList = ({ tournamentsData, isAdmin = false, app }) => {
  const { formatEventDate, initiateJoin, setSelectedEventAttendees, registrations, setIsAttendeesModalOpen, setEditingEventId, setIsExternalForm, eventForm, setIsEventModalOpen, fetchData, handleDeleteTournament, setSelectedEventDetails, setIsEventDetailsModalOpen } = app;
  return (
    <List dataSource={tournamentsData || []} renderItem={(evt) => {
      const eId = String(evt._id || evt.id);
      const isFull = evt.current_players >= evt.max_players;
      let btnText = "Csatlakozom!"; let btnType = "primary"; let btnIcon = <TeamOutlined />;
      if (evt.external_url) { btnText = "Tovább a weboldalra"; btnType = "default"; btnIcon = <LinkOutlined />; } 
      else if (isFull) { btnText = "Várólista"; btnType = "dashed"; btnIcon = <UsergroupAddOutlined />; }
      return (
        <List.Item style={S.eventItem}>
          <Card size="small" className="cozy-shadow" style={S.eventCard}>
            <div style={S.eventFlex}>
              <div style={{...S.eventInfo, cursor: !isAdmin ? 'pointer' : 'default'}} onClick={() => { if(!isAdmin) { setSelectedEventDetails(evt); setIsEventDetailsModalOpen(true); } }}>
                <img src={evt.imageUrl || getCategoryImage(evt.category)} alt={evt.name} style={S.eventImg} />
                <div style={S.eventDateBox}><CalendarOutlined style={S.eventDateIcon} /><div style={S.eventDateText}>{formatEventDate(evt.date)}</div></div>
                <div>
                  <Tag color="orange" style={S.eventTag}>{evt.category || "Egyéb"}</Tag>
                  <Title level={4} style={S.eventTitle}>{evt.name}</Title>
                  {evt.external_url ? ( <Text type="secondary" style={S.extLinkText}><LinkOutlined style={S.linkIcon}/> Külső oldal</Text> ) : ( <><Text type="secondary" style={{color: '#baaaac'}}>Létszám: <Text strong style={{color: '#E0D6C8'}}>{evt.current_players} / {evt.max_players}</Text></Text>{evt.queue_count > 0 && <Tag color="warning" style={S.queueTag}>Várólistán: {evt.queue_count}</Tag>}</> )}
                </div>
              </div>
              {!isAdmin ? (
                <Button type={btnType} icon={btnIcon} shape="round" size="large" disabled={!evt.is_open && !evt.external_url} onClick={() => initiateJoin(evt)} style={btnType === 'primary' ? S.primaryBtn : { background: '#2B1A1C', color: '#E0D6C8', borderColor: '#4A2E33' }}>
                  {(!evt.is_open && !evt.external_url) ? "Lezárva" : btnText}
                </Button>
              ) : (
                <Space>
                  {!evt.external_url && <Button type="dashed" icon={<UnorderedListOutlined />} style={{ background: '#2B1A1C', color: '#E0D6C8', borderColor: '#4A2E33' }} onClick={() => { setSelectedEventAttendees((registrations||[]).filter(reg => String(reg.tournamentId) === eId)); setIsAttendeesModalOpen(true); }}>Jelentkezők</Button>}
                  <Button type="default" icon={<EditOutlined />} style={{ background: '#2B1A1C', color: '#E5B15D', borderColor: '#4A2E33' }} onClick={() => { setEditingEventId(eId); setIsExternalForm(!!evt.external_url); eventForm.setFieldsValue({...evt, max_players: evt.max_players || 8}); setIsEventModalOpen(true); }} />
                  <Button danger={evt.is_open ? true : false} type={evt.is_open ? "primary" : "default"} onClick={() => fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'TOGGLE_GATE', payload: { tournamentId: eId, newState: !evt.is_open }}) }).then(()=>fetchData())}>{evt.is_open ? '🔒 Zárás' : '🔓 Nyitás'}</Button>
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
  
  const screens = useBreakpoint();
  const isMobile = screens.md === false;

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
      if (!dateStr) return "";
      const d = new Date(dateStr);
      if(isNaN(d)) return "";
      return d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div>
      <Title level={2} style={S.sectionTitle}><CalendarOutlined style={S.titleIcon}/> Közösségi Naptár</Title>
      <Divider style={S.divider} />

      {isMobile ? (
        (!tournaments || tournaments.length === 0) ? ( <Paragraph style={S.emptyText}>Nincs esemény.</Paragraph> ) : ( <EventList tournamentsData={tournaments} app={app} /> )
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <Button size="large" style={{ background: '#2B1A1C', color: '#E0D6C8', borderColor: '#4A2E33' }} onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}>&lt; Előző</Button>
            <Title level={2} style={{ margin: 0, color: '#E5B15D', fontFamily: 'Georgia, serif' }}>
              {months[currentDate.getMonth()]} {currentDate.getFullYear()}
            </Title>
            <Button size="large" style={{ background: '#2B1A1C', color: '#E0D6C8', borderColor: '#4A2E33' }} onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}>Következő &gt;</Button>
          </div>

          <div style={S.calendarScroll}>
            <div style={S.calendarGrid}>
              {days.map(day => <div key={day} style={S.calHeaderCell}>{day}</div>)}
              
              {emptyCells.map(i => <div key={`empty-${i}`} />)}
              
              {daysArray.map(day => {
                const dayEvents = getEventsForDay(day);
                const isToday = new Date().getDate() === day && new Date().getMonth() === currentDate.getMonth() && new Date().getFullYear() === currentDate.getFullYear();
                
                return (
                  <div key={day} style={{...S.calDayCell, borderColor: isToday ? '#E5B15D' : '#4A2E33'}}>
                    <div style={{...S.calDayNum, color: isToday ? '#E5B15D' : '#baaaac'}}>{day}</div>
                    {dayEvents.map(evt => {
                      const eId = String(evt._id || evt.id);
                      return (
                        <div 
                          key={eId} 
                          style={S.calEventStrip} 
                          onClick={() => { setSelectedEventDetails(evt); setIsEventDetailsModalOpen(true); }}
                          title={evt.name}
                        >
                          {getEventTime(evt.date)} - {evt.name}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export const AdminEvents = ({ app: v }) => {
  return (
    <div>
      <div style={S.tabHeader}>
        <Title level={3} style={S.tabTitle}>Naptár Kezelése</Title>
        <Button type="default" shape="round" style={{ background: '#2B1A1C', color: '#E0D6C8', borderColor: '#4A2E33' }} icon={<PlusOutlined />} onClick={() => { v.eventForm.resetFields(); v.setEditingEventId(null); v.setIsExternalForm(false); v.setIsEventModalOpen(true); }}>Új Esemény</Button>
      </div>
      <EventList tournamentsData={v.tournaments} isAdmin={true} app={v} />
    </div>
  );
};
