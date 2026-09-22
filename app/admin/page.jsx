"use client";

import { useState, useEffect } from 'react';
import { AdminEvents, STORES } from '@/app/components';
import { Form, Input, Button, ConfigProvider, theme, Typography, message, Divider } from 'antd';
import { LockOutlined, UserOutlined, MailOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const tavernTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#E5B15D',
    colorBgBase: '#121212',
    colorBgElevated: '#1a1012',
    colorBorder: '#4A2E33',
    colorText: '#E0D6C8',
  },
  components: {
    Input: { colorBgContainer: '#2B1A1C' }
  }
};

export default function AdminPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [tournaments, setTournaments] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [logs, setLogs] = useState([]);
  const [blacklist, setBlacklist] = useState([]);
  const [isMaintenance, setIsMaintenance] = useState(false);

  useEffect(() => {
    checkUserSession();
  }, []);

  const checkUserSession = async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        fetchAdminData();
      } else {
        setLoading(false);
      }
    } catch (e) {
      setLoading(false);
    }
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin-data?t=${Date.now()}`);
      if (response.status === 401) {
        setUser(null);
        setLoading(false);
        return;
      }
      const data = await response.json();
      if (data.tournaments) setTournaments(data.tournaments);
      if (data.registrations) setRegistrations(data.registrations);
      if (data.users) setUsersList(data.users);
      if (data.logs) setLogs(data.logs);
      if (data.blacklist) setBlacklist(data.blacklist);
      if (typeof data.isMaintenance !== 'undefined') setIsMaintenance(data.isMaintenance);
    } catch (e) {}
    setLoading(false);
  };

  const handleAuthSubmit = async (values) => {
    const action = isLoginMode ? 'login' : 'register';
    const payload = isLoginMode 
      ? { action, loginId: values.loginId, password: values.password }
      : { action, username: values.username, email: values.email, password: values.password };

    try {
      const response = await fetch('/api/auth', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      });
      const data = await response.json();
      
      if (data.error) {
        message.error(data.error);
      } else if (isLoginMode) {
        message.success(`Üdvözlünk, ${data.user.username}!`);
        setUser(data.user);
        form.resetFields();
        fetchAdminData();
      } else {
        message.success('Sikeres regisztráció! Most már bejelentkezhetsz.');
        setIsLoginMode(true);
        form.resetFields();
      }
    } catch (e) {
      message.error("Szerver hiba történt.");
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setLoading(false);
  };

  // Összegyűjtjük a szükséges adatokat és metódusokat egy "app" objektumba az AdminEvents számára
  const appProps = {
    userRole: user?.role,
    userName: user?.username,
    userEmail: user?.email,
    usersList,
    tournaments,
    registrations,
    logs,
    blacklist,
    isMaintenance,
    fetchData: fetchAdminData,
    toggleMaintenance: async (newState) => {
      await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'TOGGLE_MAINTENANCE', payload: { isMaintenance: newState } }) });
      setIsMaintenance(newState);
      fetchAdminData();
    },
    handleCleanupOldEvents: async () => {
      const res = await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'CLEANUP_OLD_EVENTS', payload: {} }) });
      const r = await res.json();
      if (r.error) message.error(r.error); else { message.success(`${r.count} esemény törölve!`); fetchAdminData(); }
    },
    eventForm: Form.useForm()[0],
    blacklistForm: Form.useForm()[0],
    passwordForm: Form.useForm()[0],
    setIsLogModalOpen: () => {},
    setIsBlacklistModalOpen: () => {},
    setIsUsersModalOpen: () => {},
    setIsEventModalOpen: () => {},
    setEditingEventId: () => {},
    setIsExternalForm: () => {},
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <Title level={3} style={{ color: '#E5B15D', fontFamily: 'Georgia, serif' }}>Rendszer betöltése...</Title>
      </div>
    );
  }

  // Ha nincs bejelentkezve -> Belépés / Regisztrációs felület
  if (!user) {
    return (
      <ConfigProvider theme={tavernTheme}>
        <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
          <div className="bg-[#1a1012] p-8 md:p-12 rounded-3xl border-2 border-[#4A2E33] shadow-2xl w-full max-w-md relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#4A2E33] via-[#E5B15D] to-[#4A2E33]"></div>

            <div className="text-center mb-8">
              <Title level={2} style={{ color: '#E5B15D', fontFamily: 'Georgia, serif', margin: 0 }}>
                {isLoginMode ? 'Tavern Admin' : 'Új Fiók'}
              </Title>
              <Text style={{ color: '#baaaac' }}>
                {isLoginMode ? 'Kérlek jelentkezz be a folytatáshoz.' : 'Szervezői fiók regisztrálása.'}
              </Text>
            </div>

            <Form form={form} layout="vertical" onFinish={handleAuthSubmit} size="large">
              {isLoginMode && (
                <>
                  <Form.Item name="loginId" rules={[{ required: true, message: 'Felhasználónév vagy E-mail kötelező!' }]}>
                    <Input prefix={<UserOutlined style={{ color: '#E5B15D' }} />} placeholder="Felhasználónév vagy E-mail" />
                  </Form.Item>
                  <Form.Item name="password" rules={[{ required: true, message: 'Jelszó kötelező!' }]}>
                    <Input.Password prefix={<LockOutlined style={{ color: '#E5B15D' }} />} placeholder="Jelszó" />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" className="w-full mt-2" style={{ background: '#E5B15D', borderColor: '#E5B15D', color: '#000', fontWeight: 'bold' }}>
                    Belépés a Vezérlőpultra
                  </Button>
                </>
              )}

              {!isLoginMode && (
                <>
                  <Form.Item name="username" rules={[{ required: true, message: 'Felhasználónév kötelező!' }]}>
                    <Input prefix={<UserOutlined style={{ color: '#E5B15D' }} />} placeholder="Felhasználónév" />
                  </Form.Item>
                  <Form.Item name="email" rules={[{ required: true, type: 'email', message: 'Érvényes e-mail kötelező!' }]}>
                    <Input prefix={<MailOutlined style={{ color: '#E5B15D' }} />} placeholder="E-mail cím" />
                  </Form.Item>
                  <Form.Item name="password" rules={[{ required: true, message: 'Jelszó kötelező!', min: 6 }]}>
                    <Input.Password prefix={<LockOutlined style={{ color: '#E5B15D' }} />} placeholder="Jelszó (min. 6 karakter)" />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" className="w-full mt-2" style={{ background: '#E5B15D', borderColor: '#E5B15D', color: '#000', fontWeight: 'bold' }}>
                    Fiók Létrehozása
                  </Button>
                </>
              )}
            </Form>

            <Divider style={{ borderColor: '#4A2E33', color: '#baaaac' }}>VAGY</Divider>

            <div className="text-center">
              <Button type="link" onClick={() => { setIsLoginMode(!isLoginMode); form.resetFields(); }} style={{ color: '#baaaac', textDecoration: 'underline' }}>
                {isLoginMode ? 'Nincs még fiókod? Regisztrálj itt!' : 'Már van fiókod? Lépj be!'}
              </Button>
            </div>
            
            <div className="text-center mt-6">
               <Button type="text" style={{ color: '#6b7280' }} onClick={() => window.location.href = '/'}>
                 &larr; Vissza a publikus naptárhoz
               </Button>
            </div>
          </div>
        </div>
      </ConfigProvider>
    );
  }

  // Ha be van jelentkezve -> Admin Vezérlőpult
  return (
    <div className="min-h-screen bg-[#121212] text-white p-4 md:p-8 relative">
      <button 
        onClick={handleLogout}
        className="absolute top-4 right-4 md:top-8 md:right-8 bg-[#2B1A1C] border border-[#4A2E33] hover:border-[#ff4d4f] text-[#baaaac] hover:text-[#ff4d4f] px-4 py-2 rounded-full flex items-center gap-2 transition-all duration-300 z-10"
      >
        <span className="font-bold text-sm">Kijelentkezés</span>
      </button>

      <div className="max-w-6xl mx-auto pt-12 md:pt-4">
        <div className="mb-8">
           <h1 className="text-4xl font-bold text-[#E5B15D] font-serif m-0">Tavern Vezérlőpult</h1>
           <p className="text-[#baaaac] text-lg mt-1">Bejelentkezve mint: <strong className="text-[#E0D6C8]">{user.username}</strong> ({user.role})</p>
        </div>

        <AdminEvents app={appProps} />
      </div>
    </div>
  );
}