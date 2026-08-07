
"use client";
import React from "react";
import { ConfigProvider, theme, Layout, Button, Space, Typography, Modal, Form, Input, Tag, Table, Popconfirm, Select, InputNumber, Upload, Switch } from "antd";
import { UserOutlined, CalendarOutlined, LinkOutlined, UploadOutlined, LogoutOutlined, DeleteOutlined } from "@ant-design/icons";

import { S } from "./styles";
import { useCalendar } from "./useCalendar";
import { CalendarView, AdminEvents, getCategoryImage } from "./components";

const { Header, Content } = Layout;
const { Title, Paragraph, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

export default function CalendarApp() {
  const app = useCalendar();

  const ThemeStyles = () => (
    <style>{`
      :root {
        --bg-base: #121212;
        --bg-container: #2B1A1C;
        --color-primary: #E5B15D;
        --color-border: #4A2E33;
        --text-base: #E0D6C8;
        --tag-bg: #4A2E33;
      }
      .ant-input, .ant-input-number-input, .ant-select-selector {
        background-color: var(--bg-base) !important;
        color: var(--text-base) !important;
        border-color: var(--color-border) !important;
      }
      .ant-btn-default:not(:disabled):hover {
        color: var(--color-primary) !important;
        border-color: var(--color-primary) !important;
      }
    `}</style>
  );

  const EventDetailsModal = () => (
    <Modal open={app.isEventDetailsModalOpen} onCancel={() => app.setIsEventDetailsModalOpen(false)} footer={null}>
      {app.selectedEventDetails && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <img src={app.selectedEventDetails.imageUrl || getCategoryImage(app.selectedEventDetails.category)} alt={app.selectedEventDetails.name} style={{ width: '100%', borderRadius: '12px', border: '1px solid #4A2E33', backgroundColor: '#0a0a0a' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Tag color="orange" style={{ background: '#4A2E33', color: '#E5B15D', border: 'none', fontSize: '14px', padding: '5px 10px' }}>{app.selectedEventDetails.category}</Tag>
                <div style={S.eventDateBox}><CalendarOutlined style={S.eventDateIcon} /><div style={S.eventDateText}>{app.formatEventDate(app.selectedEventDetails.date)}</div></div>
            </div>
            <Title level={3} style={{ color: '#E0D6C8', margin: 0, fontFamily: 'Georgia, serif' }}>{app.selectedEventDetails.name}</Title>

            {app.selectedEventDetails.description && (
                <Paragraph style={{ whiteSpace: 'pre-line', color: '#baaaac', fontSize: '15px', lineHeight: '1.6' }}>{app.selectedEventDetails.description}</Paragraph>
            )}

            {!app.selectedEventDetails.external_url && (
                <Text type="secondary" style={{ fontSize: '14px' }}>Létszám: <Text strong style={{ color: '#E0D6C8' }}>{app.selectedEventDetails.current_players} / {app.selectedEventDetails.max_players}</Text></Text>
            )}

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
      <ThemeStyles />
      <Layout style={S.layout}>
        {app.contextHolder}

        <Header style={S.header}>
          <div style={S.logoContainer} onClick={() => app.setView("calendar")}>
            <span style={S.logoText}>NAPTÁR</span>
          </div>

          <div style={S.headerRight}>
            {app.userRole === "admin" && (
                <Button type="default" shape="round" onClick={() => app.setView(app.view === 'calendar' ? 'admin' : 'calendar')} style={{ background: '#2B1A1C', color: '#E0D6C8', borderColor: '#4A2E33' }}>
                    {app.view === 'calendar' ? 'Admin Panel' : 'Vissza a naptárhoz'}
                </Button>
            )}
            {app.userRole ? (
                <Space><Text strong style={S.userName}>{app.userName}</Text><Button type="dashed" danger shape="round" size="small" icon={<LogoutOutlined />} onClick={app.handleLogout}>Kilépés</Button></Space>
            ) : (
                <Button type="primary" shape="round" icon={<UserOutlined />} onClick={() => { app.setIsRegistering(false); app.setIsAuthModalOpen(true); }} style={S.primaryBtn}>Bejelentkezés</Button>
            )}
          </div>
        </Header>

        <Content style={S.content}>
          {app.view === 'admin' ? <AdminEvents app={app} /> : <CalendarView app={app} />}
        </Content>

        <EventDetailsModal />

        {/* AUTH MODAL */}
        <Modal title={app.isRegistering ? "Regisztráció" : "Bejelentkezés"} open={app.isAuthModalOpen} onCancel={() => { app.setIsAuthModalOpen(false); app.authForm.resetFields(); }} footer={null}>
          <Form form={app.authForm} layout="vertical" onFinish={app.handleAuthSubmit} style={S.formMargin}>
            {app.isRegistering ? <><Form.Item name="username" label="Felhasználónév" rules={[{ required: true }]}><Input size="large" /></Form.Item><Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input size="large" /></Form.Item></> : <Form.Item name="loginId" label="Email vagy Név" rules={[{ required: true }]}><Input size="large" /></Form.Item>}
            <Form.Item name="password" label="Jelszó" rules={[{ required: true }]}><Input.Password size="large" /></Form.Item>
            <Form.Item><Button type="primary" htmlType="submit" size="large" block style={S.primaryBtn}>{app.isRegistering ? "Regisztráció" : "Bejelentkezés"}</Button></Form.Item>
            <div style={S.centerText}><Button type="link" onClick={() => { app.setIsRegistering(!app.isRegistering); app.authForm.resetFields(); }} style={{ color: '#E5B15D' }}>{app.isRegistering ? "Már van fiókod? Lépj be" : "Nincs fiókod? Regisztrálj"}</Button></div>
          </Form>
        </Modal>

        {/* JOIN MODAL */}
        <Modal title="Jelentkezés" open={app.isJoinModalOpen} onCancel={() => app.setIsJoinModalOpen(false)} footer={null}>
          <div style={S.modalHeaderBox}><Text strong>{app.selectedEventToJoin?.name}</Text><br/><Text type="secondary">{app.formatEventDate(app.selectedEventToJoin?.date)}</Text></div>
          <Form form={app.joinForm} layout="vertical" onFinish={app.submitJoin}>
            <Form.Item name="name" label="Név" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
            <Form.Item style={S.formActionsBasic}><Button onClick={() => app.setIsJoinModalOpen(false)} style={{...S.mr10, background: '#2B1A1C', color: '#E0D6C8'}}>Mégse</Button><Button type="primary" htmlType="submit" style={S.primaryBtn}>Megerősítés</Button></Form.Item>
          </Form>
        </Modal>

        {/* ADMIN EVENT MODAL */}
        <Modal title={app.editingEventId ? "Szerkesztés" : "Új Esemény"} open={app.isEventModalOpen} onCancel={() => app.setIsEventModalOpen(false)} footer={null}>
          <Form form={app.eventForm} layout="vertical" style={S.formMargin} initialValues={{ category: 'Egyéb' }}>
            <Form.Item label="Külső weblap?" style={S.switchBox}><Switch checked={app.isExternalForm} onChange={app.setIsExternalForm} /></Form.Item>
            <Form.Item name="name" label="Megnevezés"><Input /></Form.Item>
            <Form.Item name="category" label="Kategória">
              <Select><Option value="Riftbound">Riftbound</Option><Option value="Pokémon">Pokémon</Option><Option value="Lorcana">Lorcana</Option><Option value="Magic">Magic</Option><Option value="Yu-Gi-Oh!">Yu-Gi-Oh!</Option><Option value="One Piece">One Piece</Option><Option value="Egyéb">Egyéb</Option></Select>
            </Form.Item>
            <Form.Item name="description" label="Leírás"><TextArea rows={4} /></Form.Item>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Item name="date" label="Dátum" style={{ flex: 1 }}><Input type="datetime-local" /></Form.Item>
                {!app.isExternalForm && <Form.Item name="max_players" label="Létszám" style={{ flex: 1 }}><InputNumber style={S.w100} min={1} /></Form.Item>}
            </div>
            {app.isExternalForm && <Form.Item name="external_url" label="Link"><Input /></Form.Item>}
            <Form.Item label="Kép">
              <div style={S.uploadFlex}>
                <Upload accept="image/*" showUploadList={false} customRequest={(info) => app.handleImageUpload(info, app.eventForm)}><Button icon={<UploadOutlined />} loading={app.isUploading} style={{background: '#2B1A1C', color: '#E0D6C8'}}>Feltöltés</Button></Upload>
                <Text type="secondary">vagy link:</Text>
              </div>
            </Form.Item>
            <Form.Item name="imageUrl"><Input /></Form.Item>
            <Form.Item style={S.formActionsBasic}><Button onClick={() => app.setIsEventModalOpen(false)} style={{...S.mr10, background: '#2B1A1C', color: '#E0D6C8'}}>Mégse</Button><Button type="primary" onClick={app.saveEvent} style={S.primaryBtn}>Mentés</Button></Form.Item>
          </Form>
        </Modal>

        {/* ADMIN ATTENDEES MODAL */}
        <Modal title="Jelentkezők" open={app.isAttendeesModalOpen} onCancel={() => app.setIsAttendeesModalOpen(false)} footer={null} width={750}>
          <Table dataSource={app.selectedEventAttendees || []} rowKey={(record) => record._id || record.id} pagination={false} columns={[
            { title: 'Név', dataIndex: 'name', key: 'name' }, 
            { title: 'Email', dataIndex: 'email', key: 'email' }, 
            { title: 'Státusz', dataIndex: 'status', key: 'status', render: (s) => <Tag color={s === 'Aktív' || s === 'Active' ? 'green' : 'warning'}>{s}</Tag> }, 
            { title: 'Művelet', key: 'action', render: (_, record) => (<Popconfirm title="Törlés?" onConfirm={() => app.handleRemoveRegistration(record._id || record.id)} okText="Igen" cancelText="Mégse"><Button type="link" danger icon={<DeleteOutlined />}>Törlés</Button></Popconfirm>) }
          ]} />
        </Modal>
      </Layout>
    </ConfigProvider>
  );
}
