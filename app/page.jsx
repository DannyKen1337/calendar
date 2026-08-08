"use client";
import React from "react";
import { ConfigProvider, theme, Layout, Button, Typography, Modal, Form, Input, Tag } from "antd";
import { CalendarOutlined } from "@ant-design/icons";

import { S } from "./styles";
import { useCalendar } from "./useCalendar";
import { CalendarView, getCategoryImage } from "./components";

const { Content } = Layout;
const { Title, Paragraph, Text } = Typography;

export default function PublicCalendar() {
  const app = useCalendar();

  const EventDetailsModal = () => (
    <Modal open={app.isEventDetailsModalOpen} onCancel={() => app.setIsEventDetailsModalOpen(false)} footer={null}>
      {app.selectedEventDetails && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {/* ITT VAN A JAVÍTÁS: Fix 250px magasság, contain igazítás és belső padding */}
            <img 
              src={app.selectedEventDetails.imageUrl || getCategoryImage(app.selectedEventDetails.category)} 
              alt={app.selectedEventDetails.name} 
              style={{ 
                width: '100%', 
                height: '250px', 
                objectFit: 'contain', 
                padding: '15px', 
                borderRadius: '12px', 
                border: '1px solid #4A2E33', 
                backgroundColor: '#0a0a0a' 
              }} 
            />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Tag color="orange" style={{ background: '#4A2E33', color: '#E5B15D', border: 'none', fontSize: '14px', padding: '5px 10px' }}>{app.selectedEventDetails.category}</Tag>
                <div style={S.eventDateBox}><CalendarOutlined style={S.eventDateIcon} /><div style={S.eventDateText}>{app.formatEventDate(app.selectedEventDetails.date)}</div></div>
            </div>
            <Title level={3} style={{ color: '#E0D6C8', margin: 0, fontFamily: 'Georgia, serif' }}>{app.selectedEventDetails.name}</Title>
            {app.selectedEventDetails.description && ( <Paragraph style={{ whiteSpace: 'pre-line', color: '#baaaac', fontSize: '15px', lineHeight: '1.6' }}>{app.selectedEventDetails.description}</Paragraph> )}
            {!app.selectedEventDetails.external_url && ( <Text type="secondary" style={{ fontSize: '14px' }}>Létszám: <Text strong style={{ color: '#E0D6C8' }}>{app.selectedEventDetails.current_players} / {app.selectedEventDetails.max_players}</Text></Text> )}
            
            <Button 
              type="primary" 
              size="large" 
              shape="round" 
              block 
              style={{ ...S.primaryBtn, marginTop: '10px' }} 
              disabled={!app.selectedEventDetails.is_open && !app.selectedEventDetails.external_url} 
              onClick={() => app.initiateJoin(app.selectedEventDetails)}
            >
              {app.selectedEventDetails.external_url ? "Tovább a weboldalra" : (!app.selectedEventDetails.is_open ? "Lezárva" : (app.selectedEventDetails.current_players >= app.selectedEventDetails.max_players ? "Várólista" : "Csatlakozom!"))}
            </Button>
        </div>
      )}
    </Modal>
  );

  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { colorPrimary: '#E5B15D', colorBgBase: '#121212', colorBgContainer: '#2B1A1C', colorTextBase: '#E0D6C8', colorBorder: '#4A2E33' }}}>
      <style>{`
        :root { --bg-base: #121212; --bg-container: #2B1A1C; --color-primary: #E5B15D; --color-border: #4A2E33; --text-base: #E0D6C8; }
        .ant-input, .ant-input-number-input, .ant-select-selector { background-color: var(--bg-base) !important; color: var(--text-base) !important; border-color: var(--color-border) !important; }
        .ant-btn-default:not(:disabled):hover { color: var(--color-primary) !important; border-color: var(--color-primary) !important; }
      `}</style>
      <Layout style={{ minHeight: '100vh', background: '#121212' }}>
        {app.contextHolder}
        <Content style={S.content}>
          <CalendarView app={app} />
        </Content>
        <EventDetailsModal />
        <Modal title="Jelentkezés" open={app.isJoinModalOpen} onCancel={() => app.setIsJoinModalOpen(false)} footer={null}>
          <div style={S.modalHeaderBox}><Text strong>{app.selectedEventToJoin?.name}</Text><br/><Text type="secondary">{app.formatEventDate(app.selectedEventToJoin?.date)}</Text></div>
          <Form form={app.joinForm} layout="vertical" onFinish={app.submitJoin}>
            <Form.Item name="name" label="Név" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
            <Form.Item style={S.formActionsBasic}>
              <Button onClick={() => app.setIsJoinModalOpen(false)} style={{...S.mr10, background: '#2B1A1C', color: '#E0D6C8'}}>Mégse</Button>
              <Button type="primary" htmlType="submit" style={S.primaryBtn}>Megerősítés</Button>
            </Form.Item>
          </Form>
        </Modal>
      </Layout>
    </ConfigProvider>
  );
}