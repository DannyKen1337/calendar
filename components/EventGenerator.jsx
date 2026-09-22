"use client";
import React, { useState, useEffect } from 'react';
import { Form, Input, Select, Button, message, ConfigProvider, theme, Typography } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { GAME_CONFIG } from '@/lib/gameConfig';

const { Title } = Typography;

// Ugyanaz a sötét téma, mint a főoldalon és az admin pulton
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
    Input: { colorBgContainer: '#2B1A1C' },
    Select: { colorBgContainer: '#2B1A1C' },
  }
};

// Beimportáljuk ide is a boltokat, hogy mindig szinkronban legyen a fő kóddal
const STORES = {
  debrecen: { id: 'debrecen', name: 'Tavern Debrecen' },
  miskolc: { id: 'miskolc', name: 'Tavern Miskolc' },
  jatekceh: { id: 'jatekceh', name: 'JátékCéh' }
};

export default function EventGenerator() {
  const [form] = Form.useForm();
  const [isGenerating, setIsGenerating] = useState(false);
  const [adminName, setAdminName] = useState("Generátor");

  // Kiolvassuk a bejelentkezett admin nevét, hogy a naplóban ő szerepeljen
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedSession = localStorage.getItem('tavern_calendar_session');
      if (storedSession) {
        try {
           const userData = JSON.parse(storedSession);
           if (userData.username) setAdminName(userData.username);
         } catch (error) {}
      }
    }
  }, []);

  const handleGenerate = async (values) => {
    setIsGenerating(true);
    try {
      const { name, store, category, startDate, endDate, dayOfWeek, time, max_players, external_url, description } = values;
      
      const start = new Date(startDate);
      const end = new Date(endDate);
      const [hours, minutes] = time.split(':');
      const targetDay = parseInt(dayOfWeek);

      const eventsToCreate = [];
      let current = new Date(start);
      current.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      // Végigmegyünk a dátumokon, és kikeresjük a megfelelő napokat
      while (current <= end) {
          if (current.getDay() === targetDay) {
              const eventDate = new Date(current);
              eventDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
              
              // ISO formátumra alakítás (YYYY-MM-DDTHH:mm), ahogy az adatbázis szereti
              const pad = (n) => String(n).padStart(2, '0');
              const dateStr = `${eventDate.getFullYear()}-${pad(eventDate.getMonth()+1)}-${pad(eventDate.getDate())}T${pad(hours)}:${pad(minutes)}`;

              eventsToCreate.push({
                  name,
                  store,          // ELMENTJÜK A HELYSZÍNT!
                  category,       // ELMENTJÜK A JÁTÉKOT!
                  date: dateStr,
                  max_players: parseInt(max_players) || 16,
                  external_url: external_url || "",
                  imageUrl: "",
                  isExternalEvent: !!external_url,
                  description: description || "",
                  adminName: adminName,
                  userRole: "owner"
              });
          }
          current.setDate(current.getDate() + 1);
      }

      if (eventsToCreate.length === 0) {
          message.warning("A megadott időszakban nincs a kiválasztott napra eső dátum!");
          setIsGenerating(false);
          return;
      }

      // Végrehajtjuk a mentést a háttérben
      for (const payload of eventsToCreate) {
          await fetch('/api/actions', { 
              method: 'POST', 
              headers: { 'Content-Type': 'application/json' }, 
              body: JSON.stringify({ actionType: 'ADD_TOURNAMENT', payload }) 
          });
      }
      
      message.success(`${eventsToCreate.length} db esemény sikeresen legenerálva a(z) ${STORES[store].name} naptárába!`);
      form.resetFields();
    } catch (error) {
      message.error("Hiba történt a generálás során.");
    }
    setIsGenerating(false);
  };

  return (
    <ConfigProvider theme={tavernTheme}>
      <div className="bg-[#1a1012] p-8 rounded-2xl border border-[#4A2E33] shadow-xl w-full max-w-2xl mx-auto">
        
        <div className="flex items-center gap-3 mb-8 border-b border-[#4A2E33] pb-4">
          <CopyOutlined className="text-3xl text-[#E5B15D]" />
          <Title level={2} style={{ margin: 0, color: '#E5B15D', fontFamily: 'Georgia, serif' }}>
            Ismétlődő Generátor
          </Title>
        </div>
        
        <Form form={form} layout="vertical" onFinish={handleGenerate} className="mt-4">
          <Form.Item name="name" label="Esemény neve" rules={[{ required: true, message: 'Kötelező!' }]}>
            <Input placeholder="Pl.: Nexus Night BO1" size="large" />
          </Form.Item>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item name="store" label="Helyszín" rules={[{ required: true, message: 'Kérlek válassz boltot!' }]}>
              <Select placeholder="Válassz boltot..." size="large" allowClear>
                {Object.values(STORES).map(store => (
                  <Select.Option key={store.id} value={store.id}>{store.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item name="category" label="Kategória (Játék)" rules={[{ required: true, message: 'Kérlek válassz játékot!' }]}>
              <Select placeholder="Válassz játékot..." size="large" allowClear>
                {Object.keys(GAME_CONFIG).map(game => (
                  <Select.Option key={game} value={game}>{game}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item name="startDate" label="Mettől (Kezdő dátum)" rules={[{ required: true, message: 'Kötelező!' }]}>
              <Input type="date" size="large" />
            </Form.Item>
            <Form.Item name="endDate" label="Meddig (Záró dátum)" rules={[{ required: true, message: 'Kötelező!' }]}>
              <Input type="date" size="large" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item name="dayOfWeek" label="Melyik napokon?" rules={[{ required: true, message: 'Kötelező!' }]}>
              <Select placeholder="Válassz napot..." size="large">
                <Select.Option value="1">Hétfő</Select.Option>
                <Select.Option value="2">Kedd</Select.Option>
                <Select.Option value="3">Szerda</Select.Option>
                <Select.Option value="4">Csütörtök</Select.Option>
                <Select.Option value="5">Péntek</Select.Option>
                <Select.Option value="6">Szombat</Select.Option>
                <Select.Option value="0">Vasárnap</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="time" label="Kezdés időpontja" rules={[{ required: true, message: 'Kötelező!' }]}>
              <Input type="time" size="large" />
            </Form.Item>
          </div>

          <Form.Item name="max_players" label="Max Létszám">
            <Input type="number" placeholder="Alapértelmezett: 16" size="large" />
          </Form.Item>
          
          <Form.Item name="external_url" label="Külső jelentkezési link (Opcionális)">
            <Input placeholder="https://..." size="large" />
          </Form.Item>
          
          <Form.Item name="description" label="Leírás (Opcionális)">
            <Input.TextArea rows={4} placeholder="További részletek a versenyről..." />
          </Form.Item>

          <Button 
            type="primary" 
            htmlType="submit" 
            loading={isGenerating} 
            className="w-full h-12 text-black font-bold text-lg mt-4" 
            style={{ background: '#E5B15D', borderColor: '#E5B15D' }}
          >
            {isGenerating ? 'Generálás folyamatban...' : 'Események Generálása'}
          </Button>
        </Form>
      </div>
    </ConfigProvider>
  );
}