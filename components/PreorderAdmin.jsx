"use client";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConfigProvider, Button, Modal, Form, Input, InputNumber, Select, Segmented, Table, Tag, Popconfirm, Typography, message, Empty } from 'antd';
import { PlusOutlined, DownOutlined, RightOutlined, SearchOutlined, LinkOutlined, FileExcelOutlined, EditOutlined, DeleteOutlined, LockOutlined, UnlockOutlined, TeamOutlined, EyeOutlined, CloseOutlined, CheckOutlined, UndoOutlined } from '@ant-design/icons';
import { tavernTheme } from '@/app/components';
import { getGameColor } from '@/lib/gameConfig';
import useLiveRefresh from '@/lib/useLiveRefresh';
import { preorderLink, formatPrice, PRODUCT_NAME_MAX, PRODUCT_DESC_MAX, PRODUCT_RELEASE_MAX, PRODUCT_STOCK_MAX, PRODUCT_LIMIT_MAX, PRODUCT_PRICE_MAX } from '@/lib/preorders';

const { Title, Text } = Typography;

const panel = 'bg-[#1a1012] p-4 rounded-xl border border-[#4A2E33]';
const sideBtn = { color: '#E0D6C8', borderColor: '#4A2E33', background: '#2B1A1C' };
const formatHu = (d) => (d ? new Date(d).toLocaleString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
// Az átadott jelentkezések a lista aljára kerülnek (a többi sorrendje marad: leadás szerint); az Excelben név szerinti a sorrend
const handedLast = (orders) => [...orders].sort((a, b) => (a.handedOverAt ? 1 : 0) - (b.handedOverAt ? 1 : 0));
// A vásárló az átadás után módosította a jelentkezését (pl. más darabszám)
const changedAfterHandover = (o) => o.handedOverAt && o.updatedAt && new Date(o.updatedAt) > new Date(o.handedOverAt);
const STATUS_OPTIONS = [{ value: 'all', label: 'Mind' }, { value: 'open', label: 'Nyitott' }, { value: 'closed', label: 'Lezárt' }];

// Előrendelések kezelése: termékek játékonként, a beérkezett jelentkezések és Excel export
export default function PreorderAdmin() {
  const [messageApi, contextHolder] = message.useMessage();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('all');
  const [gameFilter, setGameFilter] = useState([]);
  const [expanded, setExpanded] = useState({}); // productId => jelentkezők látszanak
  const [expandedGames, setExpandedGames] = useState({}); // játék => a játék összes jelentkezője látszik
  const [gameQuery, setGameQuery] = useState({}); // játék => keresés a játék jelentkezői között
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
  // Az új jelentkezések oldalfrissítés nélkül is megjelennek
  useLiveRefresh(load, 10000);

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
    map.forEach((list, key) => map.set(key, handedLast(list)));
    return map;
  }, [data]);

  const copy = async (text, okText = 'Link vágólapra másolva!') => {
    try { await navigator.clipboard.writeText(text); messageApi.success(okText); }
    catch { messageApi.info({ content: text, duration: 10 }); }
  };

  const openEditor = (product) => {
    setEditing(product);
    form.setFieldsValue({ category: product.category, name: product.name || '', releaseDate: product.releaseDate || '', description: product.description || '', stock: product.stock ?? null, perPersonLimit: product.perPersonLimit ?? null, price: product.price ?? null });
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

  const setHandedOver = async (o, handedOver) => {
    if (!(await post('SET_PREORDER_HANDED_OVER', { id: o.id, handedOver }))) return;
    messageApi.success(handedOver ? `Átadva: ${o.name}` : 'Átadás visszavonva.');
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
    { title: 'Átadás', key: 'handover', width: 170, render: (_, o) => (o.handedOverAt ? (
      <div className="flex flex-col items-start gap-1">
        <span className="flex items-center gap-1">
          <Tag color="green" icon={<CheckOutlined />} style={{ margin: 0 }} title={`${formatHu(o.handedOverAt)}${o.handedOverBy ? ` – ${o.handedOverBy}` : ''}`}>Átadva</Tag>
          <Popconfirm title="Visszavonod az átadást?" onConfirm={() => setHandedOver(o, false)} okText="Igen" cancelText="Mégse">
            <Button type="text" size="small" icon={<UndoOutlined />} aria-label="Átadás visszavonása" title="Átadás visszavonása" style={{ color: '#9a8a8c' }} />
          </Popconfirm>
        </span>
        <span style={{ color: '#9a8a8c', fontSize: 12, whiteSpace: 'nowrap' }}>{formatHu(o.handedOverAt)}</span>
        {changedAfterHandover(o) && <Tag color="warning" style={{ margin: 0 }} title={`Módosítva: ${formatHu(o.updatedAt)}`}>Átadás után módosította</Tag>}
      </div>
    ) : (
      <Button size="small" icon={<CheckOutlined />} onClick={() => setHandedOver(o, true)} style={{ ...sideBtn, color: '#52c41a', borderColor: '#2f5d1f' }}>Átadás</Button>
    )) },
    { title: '', key: 'del', width: 60, render: (_, o) => (
      <Popconfirm title="Törlöd ezt a jelentkezést?" onConfirm={() => removeOrder(o)} okText="Igen" cancelText="Mégse">
        <Button type="text" danger icon={<DeleteOutlined />} aria-label="Jelentkezés törlése" />
      </Popconfirm>
    ) },
  ];

  const fadeHanded = (o) => (o.handedOverAt ? { style: { opacity: changedAfterHandover(o) ? 0.85 : 0.5 } } : {});

  const renderProduct = (p) => {
    const orders = ordersByProduct.get(p.id) || [];
    const total = orders.reduce((s, o) => s + (o.quantity || 0), 0);
    const isExpanded = !!expanded[p.id];
    const soldOut = p.stock !== null && total >= p.stock;
    const handedCount = orders.filter(o => o.handedOverAt).length;
    return (
      <div key={p.id} className="rounded-xl border p-4 bg-[#2B1A1C]" style={{ borderColor: '#4A2E33', borderLeft: `5px solid ${getGameColor({ category: p.category })}`, opacity: p.isOpen ? 1 : 0.85 }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setExpanded(e => ({ ...e, [p.id]: !e[p.id] }))}
                title="Jelentkezők megjelenítése / elrejtése"
                className="bg-transparent border-none p-0 cursor-pointer text-left flex items-center gap-2 hover:underline"
                style={{ color: '#E0D6C8', fontSize: 17, fontWeight: 'bold', overflowWrap: 'anywhere', textUnderlineOffset: 4 }}
              >
                {isExpanded ? <DownOutlined style={{ fontSize: 11, color: '#E5B15D' }} /> : <RightOutlined style={{ fontSize: 11, color: '#9a8a8c' }} />}
                {p.name}
              </button>
              <Tag color={p.isOpen ? 'green' : 'default'} style={{ margin: 0 }}>{p.isOpen ? 'Nyitott' : 'Lezárva'}</Tag>
              {soldOut && <Tag color="red" style={{ margin: 0 }}>{total > p.stock ? `Túlfoglalva (+${total - p.stock} db)` : 'Elfogyott'}</Tag>}
              {p.price !== null && <span style={{ color: '#E5B15D', fontWeight: 'bold' }}>{formatPrice(p.price)}</span>}
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
            {orders.length > 0 && <div style={{ color: handedCount === orders.length ? '#52c41a' : '#9a8a8c', fontSize: 13 }}>{handedCount} / {orders.length} átadva</div>}
            {p.price !== null && total > 0 && <div style={{ color: '#9a8a8c', fontSize: 13 }} title="Darabszám × ár">≈ {formatPrice(total * p.price)}</div>}
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
            <Table size="small" dataSource={orders} rowKey="id" columns={orderColumns} onRow={fadeHanded} pagination={orders.length > 20 ? { pageSize: 20 } : false} scroll={{ x: 890 }} locale={{ emptyText: <span style={{ color: '#6b7280' }}>Még nincs jelentkező.</span> }} />
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
          // A játék összes (a szűrésnek megfelelő) termékének jelentkezői egy táblázatban, termék szerint csoportosítva
          const productName = new Map(items.map(p => [p.id, p.name]));
          const gameOrders = items.flatMap(p => ordersByProduct.get(p.id) || []);
          const gameTotal = gameOrders.reduce((s, o) => s + (o.quantity || 0), 0);
          const gameOpen = !!expandedGames[game] && items.length > 0;
          const gq = (gameQuery[game] || '').trim().toLowerCase();
          const gameRows = handedLast(gameOrders)
            .filter(o => !gq || `${productName.get(o.productId)} ${o.name} ${o.email} ${o.phone}`.toLowerCase().includes(gq))
            .map(o => ({ ...o, productName: productName.get(o.productId) }));
          const gameColumns = [
            { title: 'Termék', dataIndex: 'productName', render: (t) => <span style={{ color: '#E5B15D' }}>{t}</span>, sorter: (a, b) => a.productName.localeCompare(b.productName, 'hu'), defaultSortOrder: 'ascend' },
            ...orderColumns,
          ];
          return (
            <section key={game} className={panel} aria-label={game}>
              <div className="flex flex-wrap items-center justify-between gap-2" style={{ marginBottom: items.length ? 12 : 0 }}>
                <Title level={5} style={{ margin: 0, fontFamily: 'Georgia, serif', color: '#E5B15D' }}>
                  <button
                    type="button"
                    disabled={items.length === 0}
                    onClick={() => setExpandedGames(e => ({ ...e, [game]: !e[game] }))}
                    title={items.length ? 'A játék összes jelentkezőjének megjelenítése / elrejtése' : undefined}
                    className="bg-transparent border-none p-0 flex items-center gap-2 text-left enabled:cursor-pointer enabled:hover:underline"
                    style={{ color: 'inherit', font: 'inherit', textUnderlineOffset: 4 }}
                  >
                    {items.length > 0 && (gameOpen ? <DownOutlined style={{ fontSize: 11 }} /> : <RightOutlined style={{ fontSize: 11, color: '#9a8a8c' }} />)}
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: getGameColor({ category: game }), display: 'inline-block' }} />
                    {game}
                    {all.length > 0 && <span style={{ color: '#9a8a8c', fontSize: 13, fontWeight: 'normal', fontFamily: 'inherit' }}>({all.length} termék · {gameOrders.length} jelentkezés · {gameTotal} db)</span>}
                  </button>
                </Title>
                <span className="flex flex-wrap gap-2">
                  {all.length > 0 && <Button size="small" icon={<FileExcelOutlined />} style={sideBtn} href={`/api/admin-preorders/export?category=${encodeURIComponent(game)}`} title={`A(z) ${game} összes termékének jelentkezői egy Excel fájlban`}>Excel</Button>}
                  <Button size="small" icon={<PlusOutlined />} style={{ ...sideBtn, color: '#E5B15D' }} onClick={() => openEditor({ category: game })}>Termék hozzáadása</Button>
                </span>
              </div>
              {gameOpen && (
                <div className="flex flex-col gap-2 mb-4 rounded-xl border p-3" style={{ borderColor: `${getGameColor({ category: game })}88`, background: '#160d0f' }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Text style={{ color: '#E0D6C8', fontWeight: 'bold' }}>{game}: összes jelentkezés ({gameOrders.length})</Text>
                    <Input size="small" allowClear prefix={<SearchOutlined style={{ color: '#E5B15D' }} />} placeholder="Keresés: termék, név, e-mail, telefon..." value={gameQuery[game] || ''} onChange={(e) => setGameQuery(q => ({ ...q, [game]: e.target.value }))} style={{ maxWidth: 320 }} />
                  </div>
                  <Table size="small" dataSource={gameRows} rowKey="id" columns={gameColumns} onRow={fadeHanded} pagination={gameRows.length > 25 ? { pageSize: 25 } : false} scroll={{ x: 1030 }} locale={{ emptyText: <span style={{ color: '#6b7280' }}>{gameOrders.length ? 'Nincs találat.' : 'Még nincs jelentkező.'}</span> }} />
                </div>
              )}
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
          <Form.Item name="price" label="Ár (nem kötelező)" extra="Darabonkénti ár forintban. A vásárló a termék mellett és a végösszegnél is látja.">
            <InputNumber min={0} max={PRODUCT_PRICE_MAX} precision={0} step={500} suffix="Ft" placeholder="Pl.: 25000" style={{ width: '100%' }} formatter={(val) => (val === undefined || val === null || val === '' ? '' : String(val).replace(/\B(?=(\d{3})+(?!\d))/g, ' '))} parser={(val) => String(val || '').replace(/\D/g, '')} />
          </Form.Item>
          <Form.Item name="releaseDate" label="Megjelenés (nem kötelező)">
            <Input maxLength={PRODUCT_RELEASE_MAX} placeholder="Pl.: 2026. november 14." />
          </Form.Item>
          <Form.Item name="description" label="Leírás (nem kötelező)" extra="Pl. tartalom, átvétel módja. A nyilvános oldalon a termék alatt jelenik meg.">
            <Input.TextArea maxLength={PRODUCT_DESC_MAX} autoSize={{ minRows: 3, maxRows: 8 }} />
          </Form.Item>
        </Form>
      </Modal>
    </ConfigProvider>
  );
}
