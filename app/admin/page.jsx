"use client";

import { useState } from 'react';
import { useCalendar } from '@/app/useCalendar';
import { AdminEvents, STORES } from '@/app/components';
import { Form, Input, Button, ConfigProvider, theme, Typography, message } from 'antd';
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
  const app = useCalendar();
  const [isLoginMode, setIsLoginMode] = useState(true);

  // 1. ÁLLAPOT: Betöltés folyamatban
  if (app.loading) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <Title level={3} style={{ color: '#E5B15D', fontFamily: 'Georgia, serif' }}>Rendszer betöltése...</Title>
      </div>
    );
  }

  // 2. ÁLLAPOT: Nincs bejelentkezve -> Hitelesítési Portál (Bejelentkezés / Regisztráció)
  if (!app.userRole) {
    return (
      <ConfigProvider theme={tavernTheme}>
        <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
          <div className="bg-[#1a1012] p-8 md:p-12 rounded-3xl border-2 border-[#4A2E33] shadow-2xl w-full max-w-md relative overflow-hidden">
            
            {/* Díszítő elem felül */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#4A2E33] via-[#E5B15D] to-[#4A2E33]"></div>

            <div className="text-center mb-8">
              <Title level={2} style={{ color: '#E5B15D', fontFamily: 'Georgia, serif', margin: 0 }}>
                {isLoginMode ? 'Tavern Admin' : 'Új Fiók'}
              </Title>
              <Text style={{ color: '#baaaac' }}>
                {isLoginMode ? 'Kérlek jelentkezz be a folytatáshoz.' : 'Szervezői fiók regisztrálása.'}
              </Text>
            </div>

            <Form 
              form={app.authForm} 
              layout="vertical" 
              onFinish={(values) => {
                // Szólunk az agynak, hogy épp regisztrálunk vagy belépünk
                app.setIsRegistering(!isLoginMode);
                app.handleAuthSubmit(values);
              }}
              size="large"
            >
              
              {/* BEJELENTKEZÉS NÉZET */}
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

              {/* REGISZTRÁCIÓS NÉZET */}
              {!isLoginMode && (
                <>
                  <Form.Item name="username" rules={[{ required: true, message: 'Felhasználónév kötelező!' }]}>
                    <Input prefix={<UserOutlined style={{ color: '#E5B15D' }} />} placeholder="Felhasználónév (pl.: joco_admin)" />
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

            {/* Váltógomb a Bejelentkezés és Regisztráció között */}
            <div className="text-center">
              <Button 
                type="link" 
                onClick={() => {
                  setIsLoginMode(!isLoginMode);
                  app.authForm.resetFields();
                }}
                style={{ color: '#baaaac', textDecoration: 'underline' }}
              >
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

  // 3. ÁLLAPOT: Sikeresen bejelentkezve -> Az igazi Admin Vezérlőpult
  return (
    <div className="min-h-screen bg-[#121212] text-white p-4 md:p-8 relative">
      
      {/* Kijelentkezés gomb a jobb felső sarokban */}
      <button 
        onClick={app.handleLogout}
        className="absolute top-4 right-4 md:top-8 md:right-8 bg-[#2B1A1C] border border-[#4A2E33] hover:border-[#ff4d4f] text-[#baaaac] hover:text-[#ff4d4f] px-4 py-2 rounded-full flex items-center gap-2 transition-all duration-300 z-10"
      >
        <span className="font-bold text-sm">Kijelentkezés</span>
      </button>

      <div className="max-w-6xl mx-auto pt-12 md:pt-4">
        
        <div className="mb-8">
           <h1 className="text-4xl font-bold text-[#E5B15D] font-serif m-0">Tavern Vezérlőpult</h1>
           <p className="text-[#baaaac] text-lg mt-1">Bejelentkezve mint: <strong className="text-[#E0D6C8]">{app.userName}</strong> ({app.userRole})</p>
        </div>

        <AdminEvents app={app} />
      </div>
    </div>
  );
}