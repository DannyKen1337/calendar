"use client";
import React, { useState, useEffect } from 'react';
import { Form, Input, Button, message, Card, Typography } from 'antd';
// Feltételezem, hogy a vezérlőpult a components.jsx-ben van AdminEvents néven
import { AdminEvents } from '@/app/components'; 

const { Title, Text } = Typography;

export default function AdminPage() {
  const [user, setUser] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form] = Form.useForm();

  useEffect(() => {
    // Ellenőrizzük, hogy be van-e jelentkezve
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.user) setUser(data.user);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSubmit = async (values) => {
    const payload = isRegistering 
      ? { action: 'register', ...values }
      : { action: 'login', loginId: values.loginId, password: values.password };
    
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        message.error(data.error || 'Hiba történt a művelet során.');
        return;
      }

      if (isRegistering) {
        message.success('Sikeres regisztráció! Most már bejelentkezhetsz.');
        setIsRegistering(false);
        form.resetFields();
      } else {
        message.success(`Üdvözlünk, ${data.user.username}!`);
        setUser(data.user);
      }
    } catch (e) {
      message.error('Szerverhiba történt.');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

  if (loading) return <div className="min-h-screen bg-[#121212] flex items-center justify-center text-[#E5B15D]">Töltés...</div>;

  // Ha VAN bejelentkezett felhasználó, mutatjuk a Vezérlőpultot
  if (user) {
    return (
      <div className="min-h-screen bg-[#121212] p-8">
        <div className="flex justify-between items-center mb-8 max-w-6xl mx-auto">
          <Title level={2} style={{ color: '#E5B15D', margin: 0 }}>Tavern Vezérlőpult</Title>
          <Button onClick={handleLogout} danger type="primary">Kijelentkezés</Button>
        </div>
        <div className="max-w-6xl mx-auto">
          {/* Ide jön majd az admin vezérlőpultod tartalma, ha betöltött. */}
          <AdminEvents user={user} /> 
        </div>
      </div>
    );
  }

  // Ha NINCS bejelentkezve, mutatjuk az Űrlapot
  return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-[#1a1012] border border-[#4A2E33] shadow-2xl rounded-2xl p-6">
        <div className="text-center mb-6">
          <Title level={2} style={{ color: '#E5B15D', fontFamily: 'Georgia, serif', margin: 0 }}>
            {isRegistering ? 'Új Admin Fiók' : 'Tavern Admin'}
          </Title>
          <Text style={{ color: '#baaaac' }}>
            {isRegistering ? 'Szervezői fiók létrehozása' : 'Jelentkezz be a folytatáshoz'}
          </Text>
        </div>

        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          {isRegistering ? (
            <>
              <Form.Item name="username" rules={[{ required: true, message: 'Kötelező!' }]}>
                <Input placeholder="Felhasználónév" size="large" />
              </Form.Item>
              <Form.Item name="email" rules={[{ required: true, type: 'email', message: 'Érvényes e-mail kell!' }]}>
                <Input placeholder="E-mail cím" size="large" />
              </Form.Item>
              <Form.Item name="password" rules={[{ required: true, message: 'Kötelező!' }]}>
                <Input.Password placeholder="Jelszó" size="large" />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item name="loginId" rules={[{ required: true, message: 'Kötelező!' }]}>
                <Input placeholder="Felhasználónév vagy E-mail" size="large" />
              </Form.Item>
              <Form.Item name="password" rules={[{ required: true, message: 'Kötelező!' }]}>
                <Input.Password placeholder="Jelszó" size="large" />
              </Form.Item>
            </>
          )}

          <Button type="primary" htmlType="submit" block size="large" style={{ background: '#E5B15D', borderColor: '#E5B15D', color: '#000', fontWeight: 'bold' }}>
            {isRegistering ? 'Regisztráció' : 'Bejelentkezés'}
          </Button>
        </Form>

        <div className="text-center mt-6">
          <Button type="link" onClick={() => { setIsRegistering(!isRegistering); form.resetFields(); }} style={{ color: '#baaaac' }}>
            {isRegistering ? 'Már van fiókod? Lépj be!' : 'Nincs még fiókod? Regisztrálj itt!'}
          </Button>
        </div>
      </Card>
    </div>
  );
}