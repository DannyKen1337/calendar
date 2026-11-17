"use client";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Modal, Form, Input, Table, Tag, Popconfirm, Segmented, Empty, Grid, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, CloseOutlined } from '@ant-design/icons';
import { getGameColor } from '@/lib/gameConfig';
import { isPokemon, isRiftbound } from '@/lib/playerBase';

// Játékos bázis játékonként: a jelentkezésekből magától bővül (/api/players), kézzel szerkeszthető. Csak a kezelt
// játékok látszanak. Pokémonnál Player ID is írható; Riftboundnál csak az idézőnév számít. Az e-mail cím csak 2. szinten.
// Gépen táblázat, telefonon kártyák.
const panel = 'bg-[#191314] rounded-xl border border-[#2a2022]';
const sideBtn = { color: '#E0D6C8', borderColor: '#2a2022', background: '#2a2022' };
const fmt = (d) => (d ? new Date(d).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
const muted = { color: '#9a8a8c', fontSize: 13 };

export default function PlayerBaseAdmin() {
  const [api, holder] = message.useMessage();
  const screens = Grid.useBreakpoint();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [game, setGame] = useState(null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null); // {} = új játékos; különben a szerkesztett játékos
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async (category) => {
    try {
      const res = await fetch(`/api/players?jatek=${encodeURIComponent(category || '')}&t=${Date.now()}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Nem sikerült betölteni.'); return; }
      setError('');
      setData(json);
      setGame(json.category);
    } catch { setError('Hálózati hiba.'); }
  }, []);
  // Az első betöltés külső rendszerből (API) szinkronizál, ezért effektben fut
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(null); }, [load]);

  const category = data?.category;
  const rb = isRiftbound(category), pk = isPokemon(category);
  const q = query.trim().toLowerCase();
  const rows = useMemo(() => (data?.players || []).filter(p => !q || [p.username, p.name, p.email, p.playerId, p.summoner, p.note].filter(Boolean).join(' ').toLowerCase().includes(q)), [data, q]);

  const openEdit = (p) => {
    setEditing(p);
    form.resetFields();
    form.setFieldsValue(p.id ? p : { username: '', name: '', email: '', playerId: '', summoner: '', note: '' });
  };
  const save = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      const res = await fetch('/api/players', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'SAVE', payload: { ...values, id: editing?.id, category } }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json.field) form.setFields([{ name: json.field, errors: [json.error] }]);
        else api.error(json.error || 'Nem sikerült menteni.');
        return;
      }
      api.success(editing?.id ? 'Elmentve.' : 'Játékos felvéve.');
      setEditing(null);
      load(category);
    } finally { setSaving(false); }
  };
  const remove = async (p) => {
    const res = await fetch('/api/players', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'DELETE', payload: { id: p.id } }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { api.error(json.error || 'Nem sikerült törölni.'); return; }
    api.success('Törölve.');
    load(category);
  };

  if (error && !data) return <div className={`${panel} p-4`} style={{ color: '#ff7875' }}>{error}</div>;
  if (!data) return <div className={`${panel} p-4`} style={{ color: '#baaaac' }}>Betöltés...</div>;

  const who = (p) => (rb
    ? <b style={{ color: '#E5B15D' }}>{p.summoner}</b>
    : <div>{p.username && <div style={{ color: '#E5B15D', fontWeight: 'bold' }}>{p.username}</div>}{p.name && <div style={{ color: '#E0D6C8' }}>{p.name}</div>}</div>);
  const seen = (p) => <div><div style={{ color: '#E0D6C8' }}>{p.events} alkalom</div><div style={muted}>{p.lastSeen ? `${fmt(p.lastSeen)}${p.lastEvent ? ` · ${p.lastEvent}` : ''}` : (p.source === 'manual' ? 'Kézzel felvéve' : '—')}</div></div>;
  const actions = (p) => (
    <span className="flex gap-1">
      <Button size="small" icon={<EditOutlined />} style={{ ...sideBtn, color: '#E5B15D' }} onClick={() => openEdit(p)} data-jatekos-szerk>Szerkesztés</Button>
      <Popconfirm title="Törlöd a játékost a listából?" description="Ha újra jelentkezik, visszakerül." onConfirm={() => remove(p)} okText="Törlés" cancelText="Mégse" okButtonProps={{ danger: true }}>
        <Button size="small" danger icon={<DeleteOutlined />} aria-label="Törlés" />
      </Popconfirm>
    </span>
  );
  const columns = [
    { title: rb ? 'Idézőnév' : 'Felhasználónév / Teljes név', key: 'who', render: (_, p) => who(p), sorter: (a, b) => (a.summoner || a.username || a.name).localeCompare(b.summoner || b.username || b.name, 'hu') },
    ...(data.personalData && !rb ? [{ title: 'E-mail', dataIndex: 'email', render: (t) => <span style={{ color: '#baaaac' }}>{t || '—'}</span> }] : []),
    ...(pk ? [{ title: 'Player ID', dataIndex: 'playerId', render: (t) => (t ? <span style={{ color: '#E0D6C8', fontVariantNumeric: 'tabular-nums' }}>{t}</span> : <span style={muted}>—</span>) }] : []),
    { title: 'Jelentkezések', key: 'seen', render: (_, p) => seen(p), sorter: (a, b) => (a.events || 0) - (b.events || 0) },
    { title: 'Megjegyzés', dataIndex: 'note', render: (t) => <span style={muted}>{t}</span> },
    { title: '', key: 'act', width: 150, render: (_, p) => actions(p) },
  ];

  return (
    <>
      {holder}
      <p style={{ color: '#9a8a8c', marginTop: 0 }}>
        A jelentkezésekből magától bővül: akit még nem ismer (e-mail cím vagy név alapján{rb ? '; Riftboundnál csak az idézőnév számít' : ''}), azt felveszi. Bárkit szerkeszthetsz, felvehetsz és törölhetsz. Csak azoknak a játékoknak a listáját látod, amelyeket kezelhetsz.
      </p>
      <div style={{ maxWidth: '100%', overflowX: 'auto', scrollbarWidth: 'none' }} className="mb-3">
        <Segmented value={game} onChange={(g) => { setGame(g); setQuery(''); load(g); }} data-jatek-valaszto
          options={data.games.map(g => ({ value: g.category, label: <span className="flex items-center gap-2"><i style={{ width: 8, height: 8, borderRadius: '50%', background: getGameColor({ category: g.category }), display: 'inline-block' }} />{g.category} ({g.count})</span> }))} />
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Input allowClear prefix={<SearchOutlined style={{ color: '#E5B15D' }} />} placeholder={rb ? 'Keresés idézőnévre...' : pk ? 'Keresés: név, Player ID...' : 'Keresés névre...'} value={query} onChange={e => setQuery(e.target.value)} style={{ maxWidth: 320, flex: 1 }} />
        <Button type="primary" icon={<PlusOutlined />} style={{ color: '#000', fontWeight: 'bold' }} onClick={() => openEdit({})} data-jatekos-uj>Új játékos</Button>
        <span style={muted}>{rows.length} játékos</span>
      </div>

      {rows.length === 0
        ? <div className={`${panel} p-6`}><Empty description={<span style={{ color: '#baaaac' }}>{data.players.length ? 'Nincs találat.' : 'Még nincs játékos ebben a játékban. Az első jelentkezéssel magától bekerül.'}</span>} /></div>
        : screens.md
          ? <div className={panel}><Table size="small" dataSource={rows} rowKey="id" columns={columns} pagination={rows.length > 50 ? { pageSize: 50, showSizeChanger: false } : false} data-jatekos-tabla /></div>
          : (
            <div className="flex flex-col gap-2" data-jatekos-kartyak>
              {rows.slice(0, 200).map(p => (
                <div key={p.id} className={`${panel} p-3 flex flex-col gap-2`} data-jatekos>
                  <div className="flex items-start justify-between gap-2">{who(p)}{pk && p.playerId && <Tag style={{ margin: 0 }}>ID {p.playerId}</Tag>}</div>
                  {data.personalData && !rb && p.email && <div style={{ color: '#baaaac', fontSize: 13, overflowWrap: 'anywhere' }}>{p.email}</div>}
                  {seen(p)}
                  {p.note && <div style={muted}>{p.note}</div>}
                  {actions(p)}
                </div>
              ))}
            </div>
          )}

      <Modal open={!!editing} onCancel={() => setEditing(null)} onOk={save} confirmLoading={saving} okText="Mentés" cancelText="Mégse"
        title={<span style={{ fontFamily: 'Georgia, serif' }}>{editing?.id ? 'Játékos szerkesztése' : 'Új játékos'} · {category}</span>}
        closeIcon={<CloseOutlined style={{ color: '#E5B15D' }} />} forceRender>
        <Form form={form} layout="vertical" requiredMark={false} data-jatekos-urlap
          onValuesChange={(changed) => form.setFields(Object.keys(changed).map(name => ({ name, errors: [] })))}>
          {rb ? (
            <Form.Item name="summoner" label="Idézőnév (Riot-azonosító)" rules={[{ required: true, message: 'Add meg az idézőnevet.' }]}><Input maxLength={60} placeholder="Név#TAG" /></Form.Item>
          ) : (
            <>
              <Form.Item name="username" label="Felhasználónév"><Input maxLength={40} /></Form.Item>
              <Form.Item name="name" label="Teljes név"><Input maxLength={120} /></Form.Item>
              {data.personalData && <Form.Item name="email" label="E-mail cím" rules={[{ type: 'email', message: 'Érvénytelen e-mail cím.' }]}><Input type="email" maxLength={200} /></Form.Item>}
              {pk && <Form.Item name="playerId" label="Player ID (Pokémon)" extra="A Play! Pokémon azonosító, csak számjegyek."><Input inputMode="numeric" maxLength={14} /></Form.Item>}
            </>
          )}
          <Form.Item name="note" label="Megjegyzés"><Input.TextArea rows={2} maxLength={300} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}
