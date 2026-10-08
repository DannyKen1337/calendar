"use client";
import React, { useState } from 'react';
import { Form, Input, Select, Button, message, ConfigProvider, theme, Typography, InputNumber, Switch, Checkbox } from 'antd';
import { CopyOutlined, LinkOutlined } from '@ant-design/icons';
import { GAME_CONFIG } from '@/lib/gameConfig';
import { resolveAttendance } from '@/lib/attendance';

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
    Input: { colorBgContainer: '#2B1A1C' },
    Select: { colorBgContainer: '#2B1A1C' },
    InputNumber: { colorBgContainer: '#2B1A1C' },
  }
};

const STORES = {
  debrecen: { id: 'debrecen', name: 'Tavern Debrecen' },
  miskolc: { id: 'miskolc', name: 'Tavern Miskolc' },
  jatekceh: { id: 'jatekceh', name: 'JátékCéh' }
};

// canManageGame: a bejelentkezett szervező kezelheti-e az adott játékot (korlátozott szervezőnél csak a saját játékai jelennek meg)
export default function EventGenerator({ canManageGame = () => true }) {
  const [form] = Form.useForm();
  const [isGenerating, setIsGenerating] = useState(false);

  // Élőben figyeljük a form mezőit, hogy tudjuk, mennyi link-mezőt kell kirajzolni
  const startDateVal = Form.useWatch('startDate', form);
  const weeksVal = Form.useWatch('weeks', form);
  const useExternalLinkVal = Form.useWatch('useExternalLink', form);
  const isOpenAttendanceVal = Form.useWatch('isOpenAttendance', form);
  const maxPlayersVal = Form.useWatch('max_players', form);
  const isOpenForm = resolveAttendance(maxPlayersVal, isOpenAttendanceVal).isOpenAttendance; // jelölőnégyzet vagy 0 a létszámnál

  const handleGenerate = async (values) => {
    setIsGenerating(true);
    try {
      const { name, store, category, startDate, time, weeks, max_players, description, useExternalLink, external_urls, isFeatured, isOpenAttendance: openChecked } = values;
      const { isOpenAttendance, max_players: resolvedMax } = resolveAttendance(max_players, openChecked);
      
      const start = new Date(startDate);
      const [hours, minutes] = time.split(':');
      const eventsToCreate = [];

      for (let i = 0; i < weeks; i++) {
        const eventDate = new Date(start);
        eventDate.setDate(eventDate.getDate() + (i * 7));
        eventDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        const pad = (n) => String(n).padStart(2, '0');
        const dateStr = `${eventDate.getFullYear()}-${pad(eventDate.getMonth()+1)}-${pad(eventDate.getDate())}T${pad(hours)}:${pad(minutes)}`;
        
        // Dinamikus link hozzárendelés
        const currentLink = (useExternalLink && external_urls && external_urls[i]) ? external_urls[i] : "";

        eventsToCreate.push({
          name,
          store,
          category,
          date: dateStr,
          max_players: resolvedMax,
          external_url: isOpenAttendance ? "" : currentLink,
          imageUrl: "",
          isExternalEvent: isOpenAttendance ? false : !!currentLink,
          description: description || "",
          isFeatured: !!isFeatured,
          isOpenAttendance: !!isOpenAttendance,
        });
      }

      if (eventsToCreate.length === 0) {
        message.warning("Nem sikerült eseményt generálni!");
        setIsGenerating(false); return;
      }

      let created = 0;
      for (const payload of eventsToCreate) {
        const res = await fetch('/api/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actionType: 'ADD_TOURNAMENT', payload }),
        });
        const data = await res.json();
        if (data.error || !res.ok) {
          message.error(data.error || `Hiba a(z) ${created + 1}. eseménynél.`);
          break;
        }
        created += 1;
      }

      if (created === 0) {
        message.warning('Egyetlen esemény sem készült el.');
      } else if (created === eventsToCreate.length) {
        message.success(`${created} db esemény sikeresen legenerálva a(z) ${STORES[store].name} naptárába!`);
      } else {
        message.warning(`${created} / ${eventsToCreate.length} esemény készült el; a többi kimaradt.`);
      }
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
        
        <Form form={form} layout="vertical" onFinish={handleGenerate} className="mt-4" initialValues={{ weeks: 4, useExternalLink: false }}>
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
                {Object.keys(GAME_CONFIG).filter(canManageGame).map(game => (
                  <Select.Option key={game} value={game}>{game}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Form.Item name="startDate" label="Kezdő dátum" rules={[{ required: true, message: 'Kötelező!' }]}>
              <Input type="date" size="large" />
            </Form.Item>
            <Form.Item name="time" label="Kezdés időpontja" rules={[{ required: true, message: 'Kötelező!' }]}>
              <Input type="time" size="large" />
            </Form.Item>
            <Form.Item name="weeks" label="Hány hétig?" rules={[{ required: true, message: 'Kötelező!' }]}>
              <InputNumber min={1} max={52} size="large" style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item name="max_players" label="Max Létszám" extra="0 = kötetlen létszám (nincs jelentkezés)">
              <Input type="number" min={0} placeholder={isOpenAttendanceVal ? 'Kötetlen létszám' : 'Alapértelmezett: 16'} size="large" disabled={!!isOpenAttendanceVal} />
            </Form.Item>
          </div>
          
          <Form.Item name="isOpenAttendance" valuePropName="checked" extra="Nincs maximum létszám és nem lehet jelentkezni: az események csak tájékoztatásul jelennek meg a naptárban.">
            <Checkbox>Kötetlen létszám (nincs jelentkezés)</Checkbox>
          </Form.Item>

          <Form.Item name="description" label="Leírás (Opcionális)">
            <Input.TextArea rows={3} placeholder="További részletek a versenyről..." />
          </Form.Item>

          <Form.Item name="isFeatured" valuePropName="checked">
            <Checkbox>Kiemelt verseny/esemény</Checkbox>
          </Form.Item>

          {/* ÚJ: Dinamikus külső link szekció */}
          {!isOpenForm && (
          <div className="mt-6 mb-6 p-4 border border-[#4A2E33] rounded-xl bg-[#2B1A1C]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <LinkOutlined className="text-[#E5B15D] text-lg" />
                <Text strong style={{ color: '#E0D6C8', fontSize: '16px' }}>Külső jelentkezési link használata?</Text>
              </div>
              <Form.Item name="useExternalLink" valuePropName="checked" noStyle>
                <Switch />
              </Form.Item>
            </div>

            {useExternalLinkVal && startDateVal && weeksVal > 0 && (
              <div className="mt-4 space-y-3 pt-4 border-t border-[#4A2E33]">
                <Text type="secondary" style={{ display: 'block', marginBottom: '10px' }}>Kérlek másold be a webshopos linkeket az alábbi hetekhez:</Text>
                {Array.from({ length: weeksVal }).map((_, i) => {
                  const d = new Date(startDateVal);
                  d.setDate(d.getDate() + (i * 7));
                  const dateString = d.toLocaleDateString('hu-HU', { month: 'long', day: 'numeric' });
                  return (
                    <Form.Item 
                      key={i} 
                      name={['external_urls', i]} 
                      label={<span style={{ color: '#E5B15D' }}>{i + 1}. Hét — {dateString}</span>}
                      rules={[{ required: true, message: 'Kötelező linket megadni!' }]}
                      style={{ marginBottom: 12 }}
                    >
                      <Input placeholder={`https://tavern.hu/termek/het-${i+1}`} />
                    </Form.Item>
                  );
                })}
              </div>
            )}
            
            {useExternalLinkVal && (!startDateVal || !weeksVal) && (
              <Text type="warning" style={{ display: 'block', marginTop: '10px' }}>
                Kérlek előbb válaszd ki a <b>Kezdő dátumot</b> és a <b>Hetek számát</b> a linkek megadásához!
              </Text>
            )}
          </div>
          )}

          <Button 
            type="primary" 
            htmlType="submit" 
            loading={isGenerating} 
            className="w-full h-12 text-black font-bold text-lg mt-2" 
            style={{ background: '#E5B15D', borderColor: '#E5B15D' }}
          >
            {isGenerating ? 'Generálás folyamatban...' : 'Események Generálása'}
          </Button>
        </Form>
      </div>
    </ConfigProvider>
  );
}