"use client";
import { useState } from 'react';
import { useCalendar } from '@/app/useCalendar';
import { AdminEvents } from '@/app/components';
import { LogoutOutlined, LockOutlined, UserOutlined, MailOutlined } from '@ant-design/icons';
import { Form, Input, Button, ConfigProvider, theme, message } from 'antd';

const tavernTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#E5B15D',
    colorBgBase: '#121212',
    colorBorder: '#4A2E33',
    colorText: '#E0D6C8',
  },
  components: {
    Input: {
      colorBgContainer: '#2B1A1C',
    }
  }
};

export default function AdminPage() {
  const app = useCalendar(); 
  const [isRegistering, setIsRegistering] = useState(false);
  const [localForm] = Form.useForm();

  // Amíg a React ellenőrzi a böngésző memóriáját (ne villanjon be a login)
  if (app.loading) {
    return <div className="min-h-screen bg-[#121212] flex items-center justify-center text-[#E5B15D] font-bold">Betöltés...</div>;
  }

  // Saját hitelesítési kezelő, ami tökéletesen kezeli a regisztrációt és a belépést is az új API-val
  const handleCustomAuth = async (values) => {
    const payload = isRegistering 
      ? { action: 'register', username: values.username, email: values.email, password: values.password }
      : { action: 'login', loginId: values.loginId, password: values.password };
    
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        message.error(data.error || 'Hiba történt!');
        return;
      }

      if (isRegistering) {
        message.success('Sikeres regisztráció! Most már bejelentkezhetsz.');
        setIsRegistering(false);
        localForm.resetFields();
      } else {
        message.success('Sikeres bejelentkezés!');
        window.location.reload(); // Frissíti az oldalt, így a useCalendar hook betölti a munkamenetet!
      }
    } catch (e) {
      message.error('Szerverhiba történt.');
    }
  };

  // BIZTONSÁGI KAPU: Ha nincs bejelentkezve, vagy csak sima játékos
  if (app.userRole !== 'admin' && app.userRole !== 'owner') {
    return (
      <ConfigProvider theme={tavernTheme}>
        {app.contextHolder}
        <main className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
          <div className="bg-[#1a1012] p-8 rounded-2xl border border-[#4A2E33] shadow-xl w-full max-w-md">
            <h1 className="text-3xl font-bold text-[#E5B15D] font-serif mb-6 text-center border-b border-[#4A2E33] pb-4">
              {isRegistering ? 'Új Admin Fiók' : 'Tavern Admin'}
            </h1>
            
            <Form form={localForm} layout="vertical" onFinish={handleCustomAuth}>
              {isRegistering ? (
                <>
                  <Form.Item name="username" rules={[{ required: true, message: 'Adja meg a felhasználónevét!' }]}>
                    <Input prefix={<UserOutlined className="text-gray-500 mr-2" />} placeholder="Felhasználónév" size="large" className="hover:border-[#E5B15D] focus:border-[#E5B15D]" />
                  </Form.Item>
                  <Form.Item name="email" rules={[{ required: true, type: 'email', message: 'Érvényes e-mail cím szükséges!' }]}>
                    <Input prefix={<MailOutlined className="text-gray-500 mr-2" />} placeholder="E-mail cím" size="large" className="hover:border-[#E5B15D] focus:border-[#E5B15D]" />
                  </Form.Item>
                  <Form.Item name="password" rules={[{ required: true, message: 'Adja meg a jelszavát!' }]}>
                    <Input.Password prefix={<LockOutlined className="text-gray-500 mr-2" />} placeholder="Jelszó" size="large" className="hover:border-[#E5B15D] focus:border-[#E5B15D]" />
                  </Form.Item>
                </>
              ) : (
                <>
                  <Form.Item name="loginId" rules={[{ required: true, message: 'Adja meg a felhasználónevét vagy e-mail címét!' }]}>
                    <Input prefix={<UserOutlined className="text-gray-500 mr-2" />} placeholder="Felhasználónév vagy E-mail" size="large" className="hover:border-[#E5B15D] focus:border-[#E5B15D]" />
                  </Form.Item>
                  <Form.Item name="password" rules={[{ required: true, message: 'Adja meg a jelszavát!' }]}>
                    <Input.Password prefix={<LockOutlined className="text-gray-500 mr-2" />} placeholder="Jelszó" size="large" className="hover:border-[#E5B15D] focus:border-[#E5B15D]" />
                  </Form.Item>
                </>
              )}
              
              <Button type="primary" htmlType="submit" className="w-full h-12 text-black font-bold text-lg rounded-xl mt-2" style={{ background: '#E5B15D', borderColor: '#E5B15D' }}>
                {isRegistering ? 'Regisztráció' : 'Bejelentkezés'}
              </Button>
            </Form>

            <div className="text-center mt-6">
              <Button type="link" onClick={() => { setIsRegistering(!isRegistering); localForm.resetFields(); }} style={{ color: '#baaaac' }}>
                {isRegistering ? 'Már van fiókod? Lépj be!' : 'Nincs még fiókod? Regisztrálj itt!'}
              </Button>
            </div>
            
          </div>
        </main>
      </ConfigProvider>
    );
  }

  // HA BE VAN JELENTKEZVE, betölt a megszokott admin pult
  return (
    <main className="min-h-screen bg-[#121212] text-white p-4 md:p-8">
      {app.contextHolder}
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex justify-between items-center border-b border-[#4A2E33] pb-4">
          <h1 className="text-3xl font-bold text-[#E5B15D] font-serif m-0">
            Admin Vezérlőpult
          </h1>
          <div className="flex items-center gap-4">
            {app.userRole === 'owner' && (
              <button
                type="button"
                onClick={() => { app.ownPasswordForm.resetFields(); app.setIsOwnPasswordModalOpen(true); }}
                className="text-[#E0D6C8] hover:text-[#E5B15D] flex items-center gap-2 font-bold transition text-lg cursor-pointer bg-transparent border-none"
              >
                <LockOutlined /> Saját jelszó
              </button>
            )}
            <div className="h-6 w-px bg-[#4A2E33]"></div>
            
            <button 
              onClick={() => app.handleLogout()}
              className="text-[#ff4d4f] hover:text-red-400 flex items-center gap-2 font-bold transition text-lg cursor-pointer bg-transparent border-none"
            >
              <LogoutOutlined /> Kijelentkezés
            </button>
          </div>
        </div>

        <div className="bg-[#2B1A1C] p-6 rounded-2xl border border-[#4A2E33]">
          {/* Most már megkapja az app propot, ahogy a régi kód is! */}
          <AdminEvents app={app} />
        </div>

      </div>
    </main>
  );
}