"use client";
import { useCalendar } from '@/app/useCalendar';
import { AdminEvents } from '@/app/components';
import { LogoutOutlined, LockOutlined, UserOutlined } from '@ant-design/icons';
import { Form, Input, Button, ConfigProvider, theme } from 'antd';

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

  // Amíg a React ellenőrzi a böngésző memóriáját (ne villanjon be a login)
  if (app.loading) {
    return <div className="min-h-screen bg-[#121212] flex items-center justify-center text-[#E5B15D] font-bold">Betöltés...</div>;
  }

  // BIZTONSÁGI KAPU: Ha nincs bejelentkezve, vagy csak sima játékos, ezt a gyönyörű Login ablakot kapja
  if (app.userRole !== 'admin' && app.userRole !== 'owner') {
    return (
      <ConfigProvider theme={tavernTheme}>
        {app.contextHolder}
        <main className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
          <div className="bg-[#1a1012] p-8 rounded-2xl border border-[#4A2E33] shadow-xl w-full max-w-md">
            <h1 className="text-3xl font-bold text-[#E5B15D] font-serif mb-6 text-center border-b border-[#4A2E33] pb-4">
              Tavern Admin
            </h1>
            <Form form={app.authForm} layout="vertical" onFinish={app.handleAuthSubmit}>
              <Form.Item name="loginId" rules={[{ required: true, message: 'Adja meg a felhasználónevét!' }]}>
                <Input 
                  prefix={<UserOutlined className="text-gray-500 mr-2" />} 
                  placeholder="Felhasználónév vagy E-mail" 
                  size="large" 
                  className="hover:border-[#E5B15D] focus:border-[#E5B15D]" 
                />
              </Form.Item>
              <Form.Item name="password" rules={[{ required: true, message: 'Adja meg a jelszavát!' }]}>
                <Input.Password 
                  prefix={<LockOutlined className="text-gray-500 mr-2" />} 
                  placeholder="Jelszó" 
                  size="large" 
                  className="hover:border-[#E5B15D] focus:border-[#E5B15D]" 
                />
              </Form.Item>
              <Button type="primary" htmlType="submit" className="w-full h-12 text-black font-bold text-lg rounded-xl mt-2" style={{ background: '#E5B15D', borderColor: '#E5B15D' }}>
                Bejelentkezés
              </Button>
            </Form>
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
            <div className="h-6 w-px bg-[#4A2E33]"></div>
            
            {/* Kijelentkezés gomb (Azonnali váltás a login képernyőre újratöltés nélkül) */}
            <button 
              onClick={() => app.handleLogout()}
              className="text-[#ff4d4f] hover:text-red-400 flex items-center gap-2 font-bold transition text-lg cursor-pointer bg-transparent border-none"
            >
              <LogoutOutlined /> Kijelentkezés
            </button>
          </div>
        </div>

        <div className="bg-[#2B1A1C] p-6 rounded-2xl border border-[#4A2E33]">
          <AdminEvents app={app} />
        </div>

      </div>
    </main>
  );
}