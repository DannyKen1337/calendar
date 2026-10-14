"use client";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConfigProvider, Button, Modal, Form, Input, InputNumber, Select, Segmented, Table, Tag, Popconfirm, Typography, message, Empty } from 'antd';
import { PlusOutlined, LinkOutlined, FileExcelOutlined, EditOutlined, DeleteOutlined, LockOutlined, UnlockOutlined, TeamOutlined, EyeOutlined, CloseOutlined } from '@ant-design/icons';
import { tavernTheme } from '@/app/components';
import { getGameColor } from '@/lib/gameConfig';
import { preorderLink, PRODUCT_NAME_MAX, PRODUCT_DESC_MAX, PRODUCT_RELEASE_MAX, PRODUCT_STOCK_MAX, PRODUCT_LIMIT_MAX } from '@/lib/preorders';

const { Title, Text } = Typography;

const panel = 'bg-[#1a1012] p-4 rounded-xl border border-[#4A2E33]';
const sideBtn = { color: '#E0D6C8', borderColor: '#4A2E33', background: '#2B1A1C' };
const formatHu = (d) => (d ? new Date(d).toLocaleString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const STATUS_OPTIONS = [{ value: 'all', label: 'Mind' }, { value: 'open', label: 'Nyitott' }, { value: 'closed', label: 'Lezárt' }];

// Előrendelések kezelése: termékek játékonként, a beérkezett jelentkezések és Excel export
export default function PreorderAdmin() {
  const [messageApi, contextHolder] = message.useMessage();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('all');
  const [gameFilter, setGameFilter] = useState([]);
  const [expanded, setExpanded] = useState({}); // productId => jelentkezők látszanak
  const [editing, setEditing] = useState(null); // null: zárva; {}: új termék; {id,...}: szerkesztés
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin-preorders', { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json || json.error) { setError((json && json.error) || 'Az adatok nem tölthetők be.'); return; }
      setError('');
      setData(json);
    } catch {
      setError('Hálózati hiba történt.');
    }
  }, []);

  // Az első betöltés külső rendszerből (API) szinkronizál, ezért effektben fut
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const post = async (actionType, payload) => {
    try {
      const res = await fetch('/api/admin-preorders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType, payload }) });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json || json.error) { messageApi.error((json && json.error) || 'A művelet nem sikerült.'); return null; }
      return json;
    } catch {
      messageApi.error('Hálózati hiba történt.');
      return null;
    }
  };

  const ordersByProduct = useMemo(() => {
    const map = new Map();
    (data?.preorders || []).forEach(o => { if (!map.has(o.productId)) map.set(o.productId, []); map.get(o.productId).push(o); });
    return map;
  }, [data]);

  const copy = async (text, okText = 'Link vágólapra másolva!') => {
    try { await navigator.clipboard.writeText(text); messageApi.success(okText); }
    catch { messageApi.info({ content: text, duration: 10 }); }
  };

  const openEditor = (product) => {
    setEditing(product);
    form.setFieldsValue({ category: product.category, name: product.name || '', releaseDate: product.releaseDate || '', description: product.description || '', stock: product.stock ?? null, perPersonLimit: product.perPersonLimit ?? null });
  };

  const save = async (values) => {
    setSaving(true);
    const ok = await post('SAVE_PRODUCT', { ...values, id: editing?.id });
    setSaving(false);
    if (!ok) return;
    messageApi.success(editing?.id ? 'Termék mentve.' : 'Termék felvéve, az előrendelés nyitott.');
    setEditing(null);
    form.resetFields();
    load();
  };

  const setOpen = async (p, isOpen) => {
    if (!(await post('SET_PRODUCT_OPEN', { id: p.id, isOpen }))) return;
    messageApi.success(isOpen ? 'Előrendelés megnyitva.' : 'Előrendelés lezárva. A jelentkezések megmaradnak.');
    load();
  };

  const removeProduct = async (p) => {
    if (!(await post('DELETE_PRODUCT', { id: p.id }))) return;
    messageApi.success('Termék törölve.');
    load();
  };

  const removeOrder = async (o) => {
    if (!(await post('DELETE_PREORDER', { id: o.id }))) return;
    messageApi.success('Jelentkezés törölve.');
    load();
  };

  if (error && !data) return <div className={panel}><Text style={{ color: '#ff7875' }}>{error}</Text></div>;
  if (!data) return <div className={panel}><Text style={{ color: '#baaaac' }}>Betöltés...</Text></div>;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const games = data.games.filter(g => gameFilter.length === 0 || gameFilter.includes(g));
  const matchesStatus = (p) => status === 'all' || (status === 'open' ? p.isOpen : !p.isOpen);
  const openCount = data.products.filter(p => p.isOpen).length;

  const orderColumns = [
    { title: 'Név', dataIndex: 'name', render: (t) => <span style={{ color: '#E0D6C8', fontWeight: 'bold' }}>{t}</span> },
    { title: 'E-mail', dataIndex: 'email', render: (t) => <a href={`mailto:${t}`} style={{ color: '#baaaac' }}>{t}</a> },
    { title: 'Telefon', dataIndex: 'phone', render: (t) => <a href={`tel:${t.replace(/[^\d+]/g, '')}`} style={{ color: '#baaaac', whiteSpace: 'nowrap' }}>{t}</a> },
    { title: 'Darab', dataIndex: 'quantity', align: 'right', width: 70 },
    { title: 'Leadva', dataIndex: 'date', render: (d, o) => <span style={{ color: '#9a8a8c', whiteSpace: 'nowrap' }} title={o.updatedAt && o.updatedAt !== d ? `Módosítva: ${formatHu(o.updatedAt)}` : undefined}>{formatHu(d)}</span> },
    { title: '', key: 'del', width: 60, render: (_, o) => (
      <Popconfirm title="Törlöd ezt a jelentkezést?" onConfirm={() => removeOrder(o)} okText="Igen" cancelText="Mégse">
        <Button type="text" danger icon={<DeleteOutlined />} aria-label="Jelentkezés törlése" />
      </Popconfirm>
    ) },
  ];

  const renderProduct = (p) => {
    const orders = ordersByProduct.get(p.id) || [];
    const total = orders.reduce((s, o) => s + (o.quantity || 0), 0);
    const isExpanded = !!expanded[p.id];
    const soldOut = p.stock !== null && total >= p.stock;
    return (
      <div key={p.id} className="rounded-xl border p-4 bg-[#2B1A1C]" style={{ borderColor: '#4A2E33', borderLeft: `5px solid ${getGameColor({ category: p.category })}`, opacity: p.isOpen ? 1 : 0.85 }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span style={{ color: '#E0D6C8', fontSize: 17, fontWeight: 'bold', overflowWrap: 'anywhere' }}>{p.name}</span>
              <Tag color={p.isOpen ? 'green' : 'default'} style={{ margin: 0 }}>{p.isOpen ? 'Nyitott' : 'Lezárva'}</Tag>
              {soldOut && <Tag color="red" style={{ margin: 0 }}>{total > p.stock ? `Túlfoglalva (+${total - p.stock} db)` : 'Elfogyott'}</Tag>}
            </div>
            <div style={{ color: '#9a8a8c', fontSize: 13, marginTop: 2 }}>
              {p.releaseDate ? `Megjelenés: ${p.releaseDate} · ` : ''}Felvette: {p.createdBy || '—'}, {formatHu(p.createdAt)}
            </div>
            <div style={{ color: '#baaaac', fontSize: 13, marginTop: 2 }}>
              Limit: <b style={{ color: '#E0D6C8' }}>{p.perPersonLimit ? `${p.perPersonLimit} db / fő` : 'korlátlan'}</b>
              {p.perPersonLimit === null && <span style={{ color: '#faad14' }}> (nincs beállítva, szerkesztéssel megadható)</span>}
              {' · '}Elérhető mennyiség: <b style={{ color: '#E0D6C8' }}>{p.stock !== null ? `${p.stock} db` : 'nincs felső határ'}</b>
            </div>
            {p.description && <div style={{ color: '#baaaac', fontSize: 13, marginTop: 4, whiteSpace: 'pre-wrap' }}>{p.description}</div>}
          </div>
          <div className="text-right shrink-0">
            <div style={{ color: soldOut ? '#ff7875' : '#E5B15D', fontSize: 22, fontWeight: 'bold', lineHeight: 1.1 }}>{total}{p.stock !== null ? ` / ${p.stock}` : ''} db</div>
            <div style={{ color: '#9a8a8c', fontSize: 13 }}>{orders.length} jelentkező</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button size="small" icon={<TeamOutlined />} style={isExpanded ? { ...sideBtn, color: '#E5B15D', borderColor: '#E5B15D' } : sideBtn} onClick={() => setExpanded(e => ({ ...e, [p.id]: !e[p.id] }))}>Jelentkezők ({orders.length})</Button>
          <Button size="small" icon={<LinkOutlined />} style={sideBtn} onClick={() => copy(preorderLink(origin, p.id))} title="Csak ezt a terméket mutató link, meghirdetéshez">Link másolása</Button>
          <Button size="small" icon={<FileExcelOutlined />} style={sideBtn} href={`/api/admin-preorders/export?productId=${encodeURIComponent(p.id)}`}>Excel</Button>
          <Button size="small" icon={<EditOutlined />} style={sideBtn} onClick={() => openEditor(p)}>Szerkesztés</Button>
          {p.isOpen
            ? <Popconfirm title="Lezárod az előrendelést?" description="A nyilvános oldalon nem jelenik meg többé, a jelentkezések megmaradnak." onConfirm={() => setOpen(p, false)} okText="Lezárás" cancelText="Mégse"><Button size="small" icon={<LockOutlined />} style={sideBtn}>Lezárás</Button></Popconfirm>
            : <Button size="small" icon={<UnlockOutlined />} style={sideBtn} onClick={() => setOpen(p, true)}>Újranyitás</Button>}
          <Popconfirm title="Törlöd a terméket?" description={orders.length ? `A hozzá tartozó ${orders.length} jelentkezés is törlődik. Előtte érdemes Excelbe menteni.` : undefined} onConfirm={() => removeProduct(p)} okText="Törlés" cancelText="Mégse" okButtonProps={{ danger: true }}>
            <Button size="small" danger icon={<DeleteOutlined />}>Törlés</Button>
          </Popconfirm>
        </div>
        {isExpanded && (
          <div className="mt-3">
            <Table size="small" dataSource={orders} rowKey="id" columns={orderColumns} pagination={orders.length > 20 ? { pageSize: 20 } : false} scroll={{ x: 720 }} locale={{ emptyText: <span style={{ color: '#6b7280' }}>Még nincs jelentkező.</span> }} />
          </div>
        )}
      </div>
    );
  };

  return (
    <ConfigProvider theme={tavernTheme}>
      {contextHolder}
      <div className="flex flex-col gap-4">
        <div className={`${panel} flex flex-col gap-3`}>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="primary" icon={<PlusOutlined />} style={{ color: '#000', fontWeight: 'bold' }} onClick={() => openEditor({ category: gameFilter.length === 1 ? gameFilter[0] : undefined })} disabled={data.games.length === 0}>Új termék</Button>
            <Button icon={<FileExcelOutlined />} style={sideBtn} href="/api/admin-preorders/export" disabled={data.products.length === 0}>Excel (összes termék)</Button>
            <Button icon={<LinkOutlined />} style={sideBtn} onClick={() => copy(preorderLink(origin))}>Nyilvános link másolása</Button>
            <Button icon={<EyeOutlined />} style={sideBtn} onClick={() => window.open('/elorendeles', '_blank', 'noopener')}>Megnyitás</Button>
          </div>
          <Text style={{ color: '#9a8a8c', fontSize: 13 }}>
            Nyilvános oldal: <span style={{ color: '#E0D6C8' }}>{preorderLink(origin)}</span> · {openCount} nyitott előrendelés. A termékeknél a „Link másolása” olyan linket ad, amely csak azt az egy terméket mutatja.
          </Text>
          <div className="flex flex-wrap items-center gap-3">
            <Segmented options={STATUS_OPTIONS} value={status} onChange={setStatus} />
            <Select mode="multiple" allowClear value={gameFilter} onChange={setGameFilter} options={data.games.map(g => ({ value: g, label: g }))} placeholder="Minden játék" maxTagCount="responsive" style={{ minWidth: 220, flex: 1 }} />
          </div>
        </div>

        {data.games.length === 0 && <div className={panel}><Empty description={<span style={{ color: '#baaaac' }}>Nincs olyan játék, amelynek a termékeit kezelheted.</span>} /></div>}

        {games.map(game => {
          const items = data.products.filter(p => p.category === game && matchesStatus(p));
          const all = data.products.filter(p => p.category === game);
          return (
            <section key={game} className={panel} aria-label={game}>
              <div className="flex flex-wrap items-center justify-between gap-2" style={{ marginBottom: items.length ? 12 : 0 }}>
                <Title level={5} style={{ margin: 0, fontFamily: 'Georgia, serif', color: '#E5B15D', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: getGameColor({ category: game }), display: 'inline-block' }} />
                  {game}
                  {all.length > 0 && <span style={{ color: '#9a8a8c', fontSize: 13, fontWeight: 'normal', fontFamily: 'inherit' }}>({all.length} termék)</span>}
                </Title>
                <Button size="small" icon={<PlusOutlined />} style={{ ...sideBtn, color: '#E5B15D' }} onClick={() => openEditor({ category: game })}>Termék hozzáadása</Button>
              </div>
              {items.length > 0
                ? <div className="flex flex-col gap-3">{items.map(renderProduct)}</div>
                : all.length > 0 && <Text style={{ color: '#6b7280', fontStyle: 'italic', fontSize: 13 }}>Nincs a szűrésnek megfelelő termék.</Text>}
            </section>
          );
        })}
      </div>

      <Modal
        title={<span style={{ fontFamily: 'Georgia, serif', color: '#E5B15D' }}>{editing?.id ? 'Termék szerkesztése' : 'Új előrendelhető termék'}</span>}
        open={editing !== null}
        onCancel={() => { setEditing(null); form.resetFields(); }}
        onOk={() => form.submit()}
        okText={editing?.id ? 'Mentés' : 'Felvétel'}
        cancelText="Mégse"
        confirmLoading={saving}
        okButtonProps={{ style: { color: '#000', fontWeight: 'bold' } }}
        closeIcon={<CloseOutlined style={{ color: '#E5B15D' }} />}
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={save} requiredMark={false} className="mt-4">
          <Form.Item name="category" label="Játék" rules={[{ required: true, message: 'Válassz játékot!' }]}>
            <Select options={data.games.map(g => ({ value: g, label: g }))} placeholder="Melyik játékhoz tartozik?" />
          </Form.Item>
          <Form.Item name="name" label="Termék / kiegészítő neve" rules={[{ required: true, whitespace: true, message: 'Add meg a termék nevét!' }]}>
            <Input maxLength={PRODUCT_NAME_MAX} placeholder="Pl.: Ascended Heroes Elite Trainer Box" />
          </Form.Item>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Form.Item name="stock" label="Elérhető mennyiség (nem kötelező)" extra="Összesen ennyi darab rendelhető elő. Ha üresen hagyod, nincs felső határ.">
              <InputNumber min={1} max={PRODUCT_STOCK_MAX} precision={0} suffix="db" placeholder="Nincs felső határ" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="perPersonLimit" label="Limit személyenként" rules={[{ required: true, message: 'Add meg a limitet (0 = korlátlan)!' }]} extra="Kötelező. A 0 korlátlant jelent. Az azonos e-mail cím és az azonos telefonszám is egy vásárlónak számít.">
              <InputNumber min={0} max={PRODUCT_LIMIT_MAX} precision={0} suffix="db / fő" placeholder="0 = korlátlan" style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="releaseDate" label="Megjelenés (nem kötelező)">
            <Input maxLength={PRODUCT_RELEASE_MAX} placeholder="Pl.: 2026. november 14." />
          </Form.Item>
          <Form.Item name="description" label="Leírás (nem kötelező)" extra="Pl. ár, tartalom, átvétel módja. A nyilvános oldalon a termék alatt jelenik meg.">
            <Input.TextArea maxLength={PRODUCT_DESC_MAX} autoSize={{ minRows: 3, maxRows: 8 }} />
          </Form.Item>
        </Form>
      </Modal>
    </ConfigProvider>
  );
}
