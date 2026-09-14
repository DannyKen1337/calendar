"use client";
import React from "react";
import { ConfigProvider, theme, Layout, Button, Space, Typography, Form, Input, Select, InputNumber, Upload, Switch, Modal, Card } from "antd";
import { LogoutOutlined, UploadOutlined } from "@ant-design/icons";

import { S } from "../styles";
import { useCalendar } from "../useCalendar";
import { AdminEvents } from "../components";
import EventGenerator from '@/components/EventGenerator';

const { Header, Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

<EventGenerator />
export default function AdminPage() {
  const app = useCalendar();

  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { colorPrimary: '#E5B15D', colorBgBase: '#121212', colorBgContainer: '#2B1A1C', colorTextBase: '#E0D6C8', colorBorder: '#4A2E33' }}}>
      <style>{`
        :root { --bg-base: #121212; --bg-container: #2B1A1C; --color-primary: #E5B15D; --color-border: #4A2E33; --text-base: #E0D6C8; }
        .ant-input, .ant-input-number-input, .ant-select-selector { background-color: var(--bg-base) !important; color: var(--text-base) !important; border-color: var(--color-border) !important; }
        .ant-btn-default:not(:disabled):hover { color: var(--color-primary) !important; border-color: var(--color-primary) !important; }
      `}</style>
      <Layout style={S.layout}>
        {app.contextHolder}

        <Header style={S.header}>
          <div style={S.logoContainer}><span style={S.logoText}>ADMIN PANEL</span></div>
          <div style={S.headerRight}>
            {app.userRole && (
                <Space><Text strong style={S.userName}>{app.userName}</Text><Button type="dashed" danger shape="round" size="small" icon={<LogoutOutlined />} onClick={app.handleLogout}>Kilépés</Button></Space>
            )}
          </div>
        </Header>

        <Content style={S.content}>
          {app.userRole === 'admin' ? (
              <AdminEvents app={app} />
          ) : (
              app.userRole ? (
                  <div style={{ textAlign: 'center', marginTop: '50px' }}>
                      <Title level={3} style={{ color: '#E5B15D' }}>Sikeres regisztráció!</Title>
                      <Paragraph style={{ color: '#E0D6C8' }}>Kérlek, szólj a fő adminisztrátornak, hogy a "Szervezők" menüben adja meg neked a jogosultságot!</Paragraph>
                  </div>
              ) : (
                  <div style={{ maxWidth: '400px', margin: '50px auto' }}>
                       <Card style={{ background: '#2B1A1C', borderColor: '#4A2E33', borderRadius: '12px' }}>
                           <Title level={3} style={{ color: '#E5B15D', textAlign: 'center', marginBottom: '20px' }}>{app.isRegistering ? "Új Szervező" : "Szervezői Belépés"}</Title>
                           <Form form={app.authForm} layout="vertical" onFinish={app.handleAuthSubmit}>
                               {app.isRegistering ? (
                                   <>
                                       <Form.Item name="username" label={<span style={{color: '#E0D6C8'}}>Név</span>} rules={[{ required: true }]}><Input size="large" /></Form.Item>
                                       <Form.Item name="email" label={<span style={{color: '#E0D6C8'}}>Email</span>} rules={[{ required: true, type: 'email' }]}><Input size="large" /></Form.Item>
                                   </>
                               ) : (
                                   <Form.Item name="loginId" label={<span style={{color: '#E0D6C8'}}>Email vagy Név</span>} rules={[{ required: true }]}><Input size="large" /></Form.Item>
                               )}
                               <Form.Item name="password" label={<span style={{color: '#E0D6C8'}}>Jelszó</span>} rules={[{ required: true }]}><Input.Password size="large" /></Form.Item>
                               <Form.Item><Button type="primary" htmlType="submit" size="large" block style={S.primaryBtn}>{app.isRegistering ? "Regisztráció" : "Belépés"}</Button></Form.Item>
                               <div style={S.centerText}><Button type="link" onClick={() => { app.setIsRegistering(!app.isRegistering); app.authForm.resetFields(); }} style={{ color: '#E5B15D' }}>{app.isRegistering ? "Már van fiókod? Lépj be" : "Új szervező regisztrálása"}</Button></div>
                           </Form>
                       </Card>
                   </div>
              )
          )}
        </Content>

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
      </Layout>
    </ConfigProvider>
  );
}



"use client";
import { useState } from 'react';
import { GAME_CONFIG } from '@/lib/gameConfig';

export default function EventGenerator() {
  const [formData, setFormData] = useState({
    name: '', category: 'Riftbound', customColor: '#6b7280',
    startDate: '', time: '18:00', weeks: 4,
    maxPlayers: 16, description: ''
  });
  const [status, setStatus] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('Generálás folyamatban...');
    
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    const result = await res.json();
    if (result.success) {
      setStatus('✅ ' + result.message);
      setFormData({...formData, name: '', description: ''}); // Alaphelyzet
    } else {
      setStatus('❌ Hiba történt: ' + result.error);
    }
  };

  return (
    <div className="bg-zinc-900 p-6 rounded-lg text-white max-w-xl">
      <h2 className="text-2xl font-bold mb-4">Ismétlődő Esemény Generátor</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 text-sm text-gray-400">Játék kategória</label>
            <select 
              value={formData.category} 
              onChange={e => setFormData({...formData, category: e.target.value})}
              className="w-full p-2 bg-zinc-800 rounded border border-zinc-700"
            >
              {Object.keys(GAME_CONFIG).map(game => (
                <option key={game} value={game}>{game}</option>
              ))}
            </select>
          </div>

          {formData.category === 'Egyéb' && (
            <div>
              <label className="block mb-1 text-sm text-gray-400">Egyedi Színkód</label>
              <input 
                type="color" 
                value={formData.customColor}
                onChange={e => setFormData({...formData, customColor: e.target.value})}
                className="w-full h-10 bg-zinc-800 rounded cursor-pointer"
              />
            </div>
          )}
        </div>

        <div>
          <label className="block mb-1 text-sm text-gray-400">Esemény neve (pl. Nexus Night BO1)</label>
          <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2 bg-zinc-800 rounded border border-zinc-700" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block mb-1 text-sm text-gray-400">Első nap</label>
            <input required type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} className="w-full p-2 bg-zinc-800 rounded border border-zinc-700" />
          </div>
          <div>
            <label className="block mb-1 text-sm text-gray-400">Időpont</label>
            <input required type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full p-2 bg-zinc-800 rounded border border-zinc-700" />
          </div>
          <div>
            <label className="block mb-1 text-sm text-gray-400">Hány hétig?</label>
            <input required type="number" min="1" max="52" value={formData.weeks} onChange={e => setFormData({...formData, weeks: e.target.value})} className="w-full p-2 bg-zinc-800 rounded border border-zinc-700" />
          </div>
        </div>

        <div>
          <label className="block mb-1 text-sm text-gray-400">Leírás (opcionális)</label>
          <textarea rows="3" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full p-2 bg-zinc-800 rounded border border-zinc-700"></textarea>
        </div>

        <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 p-3 rounded font-bold transition">
          Események Létrehozása
        </button>
        {status && <p className="text-sm text-center mt-2">{status}</p>}
      </form>
    </div>
  );
}