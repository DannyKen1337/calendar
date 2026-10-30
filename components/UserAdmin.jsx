"use client";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConfigProvider, Button, Modal, Form, Input, Tag, Popconfirm, Typography, Checkbox, Tabs, Segmented, message, Empty, Alert } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CloseOutlined, SearchOutlined, UserAddOutlined, TeamOutlined, KeyOutlined, StopOutlined, CheckCircleOutlined, CopyOutlined, SwapOutlined } from '@ant-design/icons';
import { adminTheme } from '@/components/AdminPage';
import { GAME_CONFIG, getGameColor } from '@/lib/gameConfig';
import { FEATURES, STORE_NAMES } from '@/lib/permissions';

const { Text } = Typography;
const panel = 'bg-[#191314] p-4 rounded-xl border border-[#2a2022]';
const sideBtn = { color: '#E0D6C8', borderColor: '#2a2022', background: '#2a2022' };
const modalTitle = (t) => <span style={{ fontWeight: 800, color: '#f3ece3' }}>{t}</span>;
const closeIcon = <CloseOutlined style={{ color: '#E5B15D' }} />;
const label = { color: '#9a8a8c', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 };
const GROUP_COLORS = ['#E5B15D', '#1d4ed8', '#10b981', '#b91c1c', '#8b5cf6', '#f97316', '#ec4899', '#14b8c4', '#6b7280'];
const GAMES = Object.keys(GAME_CONFIG);
const fmt = (d) => (d ? new Date(d).toLocaleString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const ROLE_ORDER = { owner: 0, admin: 1 };
const KIND_LABELS = { game: 'Játékok', store: 'Boltok', module: 'Modulok', custom: 'Egyéni csoportok' };
const KIND_HINTS = {
  game: 'Mely játékok eseményeit kezelheti.',
  store: 'Mely boltok eseményeit kezelheti.',
  module: 'Külön engedélyhez kötött részek.',
  custom: 'Saját összeállítású csoportok (több jogot egyben adnak).',
};

// Jogok rövid megjelenítése címkékkel
function AccessTags({ access, only = null }) {
  const games = access.allowedCategories;
  const stores = access.allowedStores;
  return (
    <div className="flex flex-col gap-2">
      {(!only || only === 'game') && <div>
        <div style={label}>Játékok</div>
        <div className="flex flex-wrap gap-1">
          {games === null ? <Tag color="gold" style={{ margin: 0 }}>Minden játék</Tag> : games.length === 0 ? <Tag color="red" style={{ margin: 0 }}>Egyik sem</Tag> : games.map(g => <Tag key={g} style={{ background: getGameColor({ category: g }), borderColor: getGameColor({ category: g }), color: '#fff', margin: 0 }}>{g}</Tag>)}
        </div>
      </div>}
      {(!only || only === 'store') && <div>
        <div style={label}>Boltok</div>
        <div className="flex flex-wrap gap-1">
          {stores === null ? <Tag color="gold" style={{ margin: 0 }}>Minden bolt</Tag> : stores.length === 0 ? <Tag color="red" style={{ margin: 0 }}>Egyik sem</Tag> : stores.map(s => <Tag key={s} color="geekblue" style={{ margin: 0 }}>{STORE_NAMES[s] || s}</Tag>)}
        </div>
      </div>}
      {(!only || only === 'module') && <div>
        <div style={label}>Modulok</div>
        <div className="flex flex-wrap gap-1">
          {access.features.length ? access.features.filter(f => FEATURES[f]).map(f => <Tag key={f} color="cyan" style={{ margin: 0 }}>{FEATURES[f]}</Tag>) : <Text style={{ color: '#6b7280', fontSize: 13 }}>Nincs külön modul</Text>}
        </div>
      </div>}
    </div>
  );
}


// Az „összes” csempe: ha ez van kiválasztva, az egyedi játékok / boltok feleslegesek (és fordítva)
const isAllGroup = (g) => (g.kind === 'game' && g.allowedCategories === null) || (g.kind === 'store' && g.allowedStores === null);
const unionAccess = (gs) => {
  const union = (lists) => (lists.some(l => l === null) ? null : [...new Set(lists.flat())]);
  return { allowedCategories: union(gs.map(g => g.allowedCategories)), allowedStores: union(gs.map(g => g.allowedStores)), features: [...new Set(gs.flatMap(g => g.features))] };
};

// Csoportválasztó: fajtánként kattintható csempék, felül élő összefoglaló arról, mit kezelhet.
// value / onChange: a kiválasztott csoportok azonosítói (Form.Item-ben is használható)
function GroupPicker({ value = [], onChange, groups, isOwner }) {
  const selected = new Set(value);
  const byId = new Map(groups.map(g => [g.id, g]));
  const visible = groups.filter(g => isOwner || !g.protected || selected.has(g.id));
  const toggle = (g) => {
    if (!isOwner && g.protected) return;
    const next = new Set(selected);
    if (next.has(g.id)) next.delete(g.id);
    else {
      next.add(g.id);
      // „Minden játék” mellé nem kell egyedi játék, egyedi játék mellé nem kell „Minden játék” (boltoknál ugyanígy)
      if (g.kind === 'game' || g.kind === 'store') {
        groups.filter(o => o.kind === g.kind && o.id !== g.id && (isAllGroup(g) || isAllGroup(o))).forEach(o => next.delete(o.id));
      }
    }
    onChange?.([...next]);
  };
  const chosen = [...selected].map(id => byId.get(id)).filter(Boolean);
  const access = unionAccess(chosen);
  const hasGame = access.allowedCategories === null || access.allowedCategories.length > 0;
  const hasStore = access.allowedStores === null || access.allowedStores.length > 0;

  const tile = (g) => {
    const on = selected.has(g.id);
    const locked = !isOwner && g.protected;
    return (
      <button
        key={g.id}
        type="button"
        onClick={() => toggle(g)}
        disabled={locked}
        title={locked ? 'Ezt csak a tulajdonos adhatja meg' : g.description || g.name}
        aria-pressed={on}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors disabled:cursor-not-allowed"
        style={{ border: `1px solid ${on ? g.color : '#2a2022'}`, background: on ? `${g.color}2e` : '#160d0f', color: on ? '#fff' : '#cfc6b8', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.6 : 1, fontWeight: on ? 700 : 400 }}
      >
        <span style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, border: `2px solid ${g.color}`, background: on ? g.color : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#191314', fontSize: 11, lineHeight: 1 }}>{on ? '✓' : ''}</span>
        <span style={{ overflowWrap: 'anywhere' }}>{g.name}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: '#2a2022', border: '1px solid #2a2022' }}>
        <div style={{ ...label, marginBottom: 0 }}>Ezt fogja kezelni</div>
        {chosen.length === 0
          ? <Text style={{ color: '#ff9b9b', fontSize: 13 }}>Nincs kiválasztva semmi – így semmit nem kezelhet.</Text>
          : <AccessTags access={access} />}
        {chosen.length > 0 && (!hasGame || !hasStore) && (
          <Text style={{ color: '#faad14', fontSize: 13 }}>Eseményeket csak akkor kezelhet, ha {!hasGame && !hasStore ? 'játékot és boltot is kiválasztasz' : !hasGame ? 'legalább egy játékot is kiválasztasz' : 'legalább egy boltot is kiválasztasz'}.</Text>
        )}
      </div>
      {['game', 'store', 'module', 'custom'].map(kind => {
        const list = visible.filter(g => g.kind === kind).sort((a, b) => (isAllGroup(b) - isAllGroup(a)) || a.name.localeCompare(b.name, 'hu'));
        if (!list.length) return null;
        const count = list.filter(g => selected.has(g.id)).length;
        return (
          <div key={kind} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span style={{ color: '#E5B15D', fontWeight: 'bold' }}>{KIND_LABELS[kind]}{count ? <span style={{ color: '#9a8a8c', fontWeight: 'normal' }}> · {count} kiválasztva</span> : null}</span>
              <span style={{ color: '#7d6e70', fontSize: 12 }}>{KIND_HINTS[kind]}</span>
            </div>
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>{list.map(tile)}</div>
          </div>
        );
      })}
      {groups.length === 0 && <Text style={{ color: '#6b7280' }}>Még nincs csoport. Előbb hozz létre egyet a Csoportok fülön.</Text>}
    </div>
  );
}

// Felhasználók és szervezői csoportok kezelése (csak a tulajdonos)
export default function UserAdmin({ currentUserId }) {
  const [messageApi, contextHolder] = message.useMessage();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('users');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [groupEdit, setGroupEdit] = useState(null);   // null: zárva; {}: új; {id,...}: szerkesztés
  const [membershipUser, setMembershipUser] = useState(null);
  const [membershipIds, setMembershipIds] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [credentials, setCredentials] = useState(null); // { username, email, tempPassword, expiresAt, title }
  const [groupForm] = Form.useForm();
  const [createForm] = Form.useForm();
  const createRole = Form.useWatch('role', createForm);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin-users', { cache: 'no-store' });
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

  const post = async (actionType, payload, form) => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin-users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType, payload }) });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json || json.error) {
        const msg = (json && json.error) || 'A művelet nem sikerült.';
        if (form && json?.field) form.setFields([{ name: json.field, errors: [msg] }]);
        else messageApi.error(msg);
        return null;
      }
      return json;
    } catch {
      messageApi.error('Hálózati hiba történt.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const groupsById = useMemo(() => new Map((data?.groups || []).map(g => [g.id, g])), [data]);
  const isOwner = !!data?.isOwner;

  if (error && !data) return <div className={panel}><Text style={{ color: '#ff7875' }}>{error}</Text></div>;
  if (!data) return <div className={panel}><Text style={{ color: '#baaaac' }}>Betöltés...</Text></div>;

  // --- Műveletek ---
  const openGroup = (g) => {
    setGroupEdit(g);
    groupForm.resetFields();
    groupForm.setFieldsValue({
      name: g.name || '', description: g.description || '', color: g.color || GROUP_COLORS[0],
      allCategories: g.id ? g.allowedCategories === null : false, categories: g.allowedCategories || [],
      allStores: g.id ? g.allowedStores === null : true, stores: g.allowedStores || [],
      features: g.features || [],
    });
  };
  const saveGroup = async (values) => {
    if (!(await post('SAVE_GROUP', { ...values, id: groupEdit?.id }, groupForm))) return;
    messageApi.success(groupEdit?.id ? 'Csoport mentve. A tagok jogai azonnal frissültek.' : 'Csoport létrehozva.');
    setGroupEdit(null);
    load();
  };
  const deleteGroup = async (g) => {
    if (!(await post('DELETE_GROUP', { id: g.id }))) return;
    messageApi.success('Csoport törölve.');
    load();
  };
  const openMembership = (u) => { setMembershipUser(u); setMembershipIds(u.groupIds); };
  const saveMembership = async () => {
    if (!(await post('SET_USER_GROUPS', { userId: membershipUser.id, groupIds: membershipIds }))) return;
    messageApi.success('Csoportok mentve.');
    setMembershipUser(null);
    load();
  };
  const simple = async (actionType, payload, okText) => {
    const res = await post(actionType, payload);
    if (!res) return null;
    if (okText) messageApi.success(okText);
    load();
    return res;
  };
  const resetPassword = async (u) => {
    const res = await simple('RESET_PASSWORD', { userId: u.id });
    if (res) setCredentials({ ...res, title: 'Új ideiglenes jelszó' });
  };
  const createUser = async (values) => {
    const res = await post('CREATE_USER', values, createForm);
    if (!res) return;
    setCreateOpen(false);
    setCredentials({ ...res, title: 'Fiók létrehozva' });
    load();
  };
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); messageApi.success('Vágólapra másolva.'); } catch { messageApi.info(text); }
  };

  // --- Szűrés ---
  const q = query.trim().toLowerCase();
  const users = [...data.users]
    .filter(u => !q || `${u.username} ${u.email}`.toLowerCase().includes(q))
    .filter(u => filter === 'all' || (filter === 'staff' ? (u.role === 'admin' || u.role === 'owner') : filter === 'players' ? (u.role !== 'admin' && u.role !== 'owner') : filter === 'disabled' ? u.disabled : filter === 'legacy' ? (u.role === 'admin' && !u.usesGroups) : true))
    .sort((a, b) => (ROLE_ORDER[a.role] ?? 2) - (ROLE_ORDER[b.role] ?? 2) || a.username.localeCompare(b.username, 'hu'));
  const legacyCount = data.users.filter(u => u.role === 'admin' && !u.usesGroups).length;
  const counts = {
    all: data.users.length,
    staff: data.users.filter(u => u.role === 'admin' || u.role === 'owner').length,
    players: data.users.filter(u => u.role !== 'admin' && u.role !== 'owner').length,
    disabled: data.users.filter(u => u.disabled).length,
  };

  const roleTag = (role) => (role === 'owner' ? <Tag color="purple" style={{ margin: 0 }}>Tulajdonos</Tag> : role === 'admin' ? <Tag color="orange" style={{ margin: 0 }}>Szervező</Tag> : <Tag color="green" style={{ margin: 0 }}>Játékos</Tag>);

  const userCard = (u) => {
    const isOwner = u.role === 'owner';
    const isSelf = u.id === currentUserId;
    const isManager = u.access.features.includes('users');
    const canEdit = !isOwner && !isSelf && (data.isOwner || !isManager);
    return (
      <div key={u.id} className="rounded-xl border p-4 flex flex-col gap-3" style={{ borderColor: isOwner ? '#722ed1' : u.disabled ? '#a8071a' : '#2a2022', background: '#191314', opacity: u.disabled ? 0.75 : 1 }}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div style={{ color: '#E0D6C8', fontWeight: 'bold', fontSize: 16, overflowWrap: 'anywhere' }}>{u.username}</div>
            <div style={{ color: '#baaaac', fontSize: 13, overflowWrap: 'anywhere' }}>{u.email}</div>
            <div style={{ color: '#7d6e70', fontSize: 12, marginTop: 2 }}>
              {u.lastLoginAt ? `Utolsó belépés: ${fmt(u.lastLoginAt)}` : 'Még nem lépett be'}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {roleTag(u.role)}
            {u.disabled && <Tag color="red" style={{ margin: 0 }}>Felfüggesztve</Tag>}
            {u.mustChangePassword && <Tag color="blue" style={{ margin: 0 }}>Ideiglenes jelszó</Tag>}
          </div>
        </div>

        {u.role === 'admin' && (
          <>
            <div>
              <div style={label}>Csoportok</div>
              <div className="flex flex-wrap gap-1">
                {u.usesGroups
                  ? (u.groupIds.length
                    ? u.groupIds.map(id => groupsById.get(id)).filter(Boolean).map(g => <Tag key={g.id} onClick={canEdit ? () => openMembership(u) : undefined} style={{ margin: 0, background: `${g.color}33`, borderColor: g.color, color: '#E0D6C8', cursor: canEdit ? 'pointer' : 'default' }}>{g.name}</Tag>)
                    : <Tag color="red" style={{ margin: 0 }}>Nincs csoport – nem kezelhet semmit</Tag>)
                  : <Tag color="warning" style={{ margin: 0 }}>Egyéni jogok (régi beállítás)</Tag>}
              </div>
            </div>
            <details>
              <summary style={{ color: '#9a8a8c', fontSize: 13, cursor: 'pointer' }}>Tényleges jogok</summary>
              <div className="mt-2"><AccessTags access={u.access} /></div>
            </details>
          </>
        )}
        {isOwner && <Text style={{ color: '#9a8a8c', fontSize: 13 }}>Minden játékot, boltot és modult kezel, és csak ő kezelheti a felhasználókat.</Text>}

        {canEdit ? (
          <div className="flex flex-wrap gap-2 pt-3 border-t border-[#2a2022]">
            {u.role === 'admin' && <Button size="small" icon={<TeamOutlined />} style={{ ...sideBtn, color: '#E5B15D' }} onClick={() => openMembership(u)}>Jogosultságok</Button>}
            {u.role === 'admin' && !u.usesGroups && (
              <Popconfirm title="Egyéni jogok átalakítása csoporttá?" description="Azonos beállítású csoportot használ, ha van ilyen, különben újat hoz létre. A jogai nem változnak." onConfirm={() => simple('CONVERT_TO_GROUP', { userId: u.id }, 'Átalakítva csoporttá.')} okText="Átalakítás" cancelText="Mégse">
                <Button size="small" icon={<SwapOutlined />} style={sideBtn}>Csoporttá alakítás</Button>
              </Popconfirm>
            )}
            <Popconfirm title="Új ideiglenes jelszót generálsz?" description="A régi jelszó azonnal érvényét veszti. Az új jelszóval belépve saját jelszót kell beállítania." onConfirm={() => resetPassword(u)} okText="Generálás" cancelText="Mégse">
              <Button size="small" icon={<KeyOutlined />} style={sideBtn}>Új jelszó</Button>
            </Popconfirm>
            {u.role === 'admin'
              ? <Popconfirm title="Visszafokozod játékossá?" description="Elveszíti a szervezői hozzáférést." onConfirm={() => simple('SET_ROLE', { userId: u.id, role: 'customer' }, 'Visszafokozva játékossá.')} okText="Igen" cancelText="Mégse"><Button size="small" style={sideBtn}>Visszafokozás</Button></Popconfirm>
              : <Popconfirm title="Szervezővé teszed?" description="A csoportjai alapján kap jogokat (csoport nélkül semmit nem kezelhet)." onConfirm={() => simple('SET_ROLE', { userId: u.id, role: 'admin' }, 'Szervezővé téve.')} okText="Igen" cancelText="Mégse"><Button size="small" style={sideBtn}>Szervezővé tétel</Button></Popconfirm>}
            {u.disabled
              ? <Button size="small" icon={<CheckCircleOutlined />} style={{ ...sideBtn, color: '#8fd18f' }} onClick={() => simple('SET_DISABLED', { userId: u.id, disabled: false }, 'Visszaengedve.')}>Visszaengedés</Button>
              : <Popconfirm title="Felfüggeszted a fiókot?" description="Nem tud belépni, és ha most be van lépve, azonnal kijelentkezik. Bármikor visszaengedhető." onConfirm={() => simple('SET_DISABLED', { userId: u.id, disabled: true }, 'Felfüggesztve.')} okText="Felfüggesztés" cancelText="Mégse" okButtonProps={{ danger: true }}><Button size="small" icon={<StopOutlined />} style={sideBtn}>Felfüggesztés</Button></Popconfirm>}
            <Popconfirm title="Véglegesen törlöd a fiókot?" description="Ez nem vonható vissza. Ha csak ideiglenesen tiltanád, használd a felfüggesztést." onConfirm={() => simple('DELETE_USER', { userId: u.id }, 'Fiók törölve.')} okText="Törlés" cancelText="Mégse" okButtonProps={{ danger: true }}>
              <Button size="small" danger icon={<DeleteOutlined />} style={{ marginLeft: 'auto' }}>Törlés</Button>
            </Popconfirm>
          </div>
        ) : (
          <Text style={{ color: '#6b7280', fontSize: 12 }} className="pt-3 border-t border-[#2a2022]">{isSelf ? 'A saját fiókod' : isOwner ? 'Védett fiók' : 'Felhasználókezelő fiókot csak a tulajdonos módosíthat'}</Text>
        )}
      </div>
    );
  };

  const groupCard = (g) => {
    const memberNames = data.users.filter(u => u.groupIds.includes(g.id)).map(u => u.username);
    return (
      <div key={g.id} className="rounded-xl border p-4 flex flex-col gap-3" style={{ borderColor: '#2a2022', borderLeft: `5px solid ${g.color}`, background: '#191314' }}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div style={{ color: '#E0D6C8', fontWeight: 'bold', fontSize: 16, overflowWrap: 'anywhere' }}>{g.name}</div>
            {g.description && <div style={{ color: '#baaaac', fontSize: 13 }}>{g.description}</div>}
          </div>
          <span className="flex flex-col items-end gap-1">
            <Tag style={{ margin: 0 }}>{g.members} tag</Tag>
            {g.protected && <Tag color="purple" style={{ margin: 0 }}>Csak tulajdonos módosíthatja</Tag>}
          </span>
        </div>
        <AccessTags access={{ allowedCategories: g.allowedCategories, allowedStores: g.allowedStores, features: g.features }} only={g.kind === 'custom' ? null : g.kind} />
        <div>
          <div style={label}>Tagok</div>
          <Text style={{ color: memberNames.length ? '#E0D6C8' : '#6b7280', fontSize: 13 }}>{memberNames.join(', ') || 'Még nincs tagja'}</Text>
        </div>
        {(isOwner || !g.protected) && <div className="flex flex-wrap gap-2 pt-3 border-t border-[#2a2022]">
          <Button size="small" icon={<EditOutlined />} style={{ ...sideBtn, color: '#E5B15D' }} onClick={() => openGroup(g)}>Szerkesztés</Button>
          <Popconfirm title="Törlöd a csoportot?" description={g.members ? `${g.members} tag elveszíti a csoport jogait.` : undefined} onConfirm={() => deleteGroup(g)} okText="Törlés" cancelText="Mégse" okButtonProps={{ danger: true }}>
            <Button size="small" danger icon={<DeleteOutlined />} style={{ marginLeft: 'auto' }}>Törlés</Button>
          </Popconfirm>
        </div>}
      </div>
    );
  };

  return (
    <ConfigProvider theme={adminTheme}>
      {contextHolder}
      <div className={panel}>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          tabBarExtraContent={tab === 'users'
            ? <Button type="primary" icon={<UserAddOutlined />} style={{ color: '#000', fontWeight: 'bold' }} onClick={() => { createForm.resetFields(); createForm.setFieldsValue({ role: 'admin', groupIds: [] }); setCreateOpen(true); }}>Új fiók</Button>
            : <Button type="primary" icon={<PlusOutlined />} style={{ color: '#000', fontWeight: 'bold' }} onClick={() => openGroup({})}>Új csoport</Button>}
          items={[
            {
              key: 'users',
              label: `Felhasználók (${data.users.length})`,
              children: (
                <div className="flex flex-col gap-3">
                  {legacyCount > 0 && (
                    <Alert type="warning" showIcon message={`${legacyCount} szervezőnek még egyéni (régi) jogai vannak.`} description="Ezek változatlanul működnek. A „Csoporttá alakítás” gombbal egy kattintással csoportra válthatod őket, vagy a „Csoportok” gombbal meglévő csoportba teheted." />
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Input allowClear prefix={<SearchOutlined style={{ color: '#E5B15D' }} />} placeholder="Keresés név vagy e-mail alapján..." value={query} onChange={(e) => setQuery(e.target.value)} style={{ maxWidth: 320 }} />
                    {/* Telefonon a szűrősor oldalra görgethető, hogy ne lógjon ki a képernyőről */}
                    <div style={{ maxWidth: '100%', overflowX: 'auto', scrollbarWidth: 'none' }}>
                    <Segmented value={filter} onChange={setFilter} options={[
                      { value: 'all', label: `Mind (${counts.all})` },
                      { value: 'staff', label: `Szervezők (${counts.staff})` },
                      { value: 'players', label: `Játékosok (${counts.players})` },
                      ...(counts.disabled ? [{ value: 'disabled', label: `Felfüggesztett (${counts.disabled})` }] : []),
                      ...(legacyCount ? [{ value: 'legacy', label: `Régi jogok (${legacyCount})` }] : []),
                    ]} />
                    </div>
                  </div>
                  {users.length === 0 ? <Empty description={<span style={{ color: '#6b7280' }}>Nincs találat.</span>} /> : <div className="grid gap-3 md:grid-cols-2">{users.map(userCard)}</div>}
                </div>
              ),
            },
            {
              key: 'groups',
              label: `Csoportok (${data.groups.length})`,
              children: (
                <div className="flex flex-col gap-3">
                  <Text style={{ color: '#9a8a8c', fontSize: 13 }}>A szervezők a csoportjaik alapján kapnak jogot, a csoportok jogai összeadódnak. Az eseménykezeléshez legalább egy játék- és egy boltcsoport kell (pl. „Pokémon TCG” + „Tavern Debrecen”), a modulok (előrendelés, liga, felhasználókezelés) külön adhatók. Egy csoport módosítása azonnal érvényes minden tagjára.</Text>
                  {data.groups.length === 0 ? <Empty description={<span style={{ color: '#6b7280' }}>Még nincs csoport. Hozz létre egyet az „Új csoport” gombbal.</span>} /> : ['game', 'store', 'module', 'custom'].map(kind => {
                    const list = data.groups.filter(g => g.kind === kind);
                    if (!list.length) return null;
                    return (
                      <section key={kind} className="flex flex-col gap-2 mt-2">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span style={{ color: '#f3ece3', fontWeight: 800, fontSize: 16 }}>{KIND_LABELS[kind]}</span>
                          <span style={{ color: '#7d6e70', fontSize: 12 }}>{KIND_HINTS[kind]}</span>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{list.map(groupCard)}</div>
                      </section>
                    );
                  })}
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* Csoport létrehozása / szerkesztése */}
      <Modal title={modalTitle(groupEdit?.id ? 'Csoport szerkesztése' : 'Új csoport')} open={groupEdit !== null} onCancel={() => setGroupEdit(null)} onOk={() => groupForm.submit()} okText="Mentés" cancelText="Mégse" confirmLoading={busy} okButtonProps={{ style: { color: '#000', fontWeight: 'bold' } }} closeIcon={closeIcon} width={640} forceRender>
        <Form form={groupForm} layout="vertical" requiredMark={false} onFinish={saveGroup} className="mt-4">
          <Form.Item name="name" label="Név" rules={[{ required: true, whitespace: true, message: 'Add meg a csoport nevét!' }]}>
            <Input maxLength={60} placeholder="Pl.: Pokémon szervezők – Debrecen" />
          </Form.Item>
          <Form.Item name="description" label="Leírás (nem kötelező)">
            <Input maxLength={300} placeholder="Pl.: a debreceni Pokémon események szervezői" />
          </Form.Item>
          <Form.Item name="color" label="Szín">
            <Segmented options={GROUP_COLORS.map(c => ({ value: c, label: <span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: '50%', background: c, verticalAlign: 'middle' }} /> }))} />
          </Form.Item>
          <Form.Item name="allCategories" valuePropName="checked" style={{ marginBottom: 8 }}><Checkbox>Minden játékot kezelhet</Checkbox></Form.Item>
          <Form.Item noStyle shouldUpdate={(a, b) => a.allCategories !== b.allCategories}>
            {({ getFieldValue }) => !getFieldValue('allCategories') && (
              <Form.Item name="categories" label="Játékok">
                <Checkbox.Group style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                  {GAMES.map(g => <Checkbox key={g} value={g}>{g}</Checkbox>)}
                </Checkbox.Group>
              </Form.Item>
            )}
          </Form.Item>
          <Form.Item name="allStores" valuePropName="checked" style={{ marginBottom: 8 }}><Checkbox>Minden boltot kezelhet</Checkbox></Form.Item>
          <Form.Item noStyle shouldUpdate={(a, b) => a.allStores !== b.allStores}>
            {({ getFieldValue }) => !getFieldValue('allStores') && (
              <Form.Item name="stores" label="Boltok">
                <Checkbox.Group style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {Object.entries(STORE_NAMES).map(([id, name]) => <Checkbox key={id} value={id}>{name}</Checkbox>)}
                </Checkbox.Group>
              </Form.Item>
            )}
          </Form.Item>
          <Form.Item name="features" label="Modulok" extra="Ezekhez csak a csoport tagjai férnek hozzá, ott is csak a fent kiválasztott játékoknál.">
            <Checkbox.Group style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {Object.entries(FEATURES).map(([key, name]) => <Checkbox key={key} value={key}>{name}</Checkbox>)}
            </Checkbox.Group>
          </Form.Item>
        </Form>
      </Modal>

      {/* Csoporttagság */}
      <Modal title={modalTitle(`Jogosultságok: ${membershipUser?.username || ''}`)} open={!!membershipUser} onCancel={() => setMembershipUser(null)} onOk={saveMembership} okText="Mentés" cancelText="Mégse" confirmLoading={busy} okButtonProps={{ style: { color: '#000', fontWeight: 'bold' } }} closeIcon={closeIcon} width={760}>
        <div className="flex flex-col gap-3 pt-2">
          <Text style={{ color: '#baaaac' }}>Kattints arra, amit kezelhet. Legalább egy játék és egy bolt kell az eseményekhez, a modulok külön adhatók.</Text>
          {membershipUser && !membershipUser.usesGroups && <Alert type="info" showIcon message="Mentés után a régi egyéni jogai megszűnnek, és csak az itt kiválasztottak számítanak." />}
          <GroupPicker value={membershipIds} onChange={setMembershipIds} groups={data.groups} isOwner={isOwner} />
        </div>
      </Modal>

      {/* Új fiók */}
      <Modal title={modalTitle('Új fiók')} open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => createForm.submit()} okText="Létrehozás" cancelText="Mégse" confirmLoading={busy} okButtonProps={{ style: { color: '#000', fontWeight: 'bold' } }} closeIcon={closeIcon} width={760} forceRender>
        <Form form={createForm} layout="vertical" requiredMark={false} onFinish={createUser} className="mt-4">
          <Form.Item name="username" label="Felhasználónév" rules={[{ required: true, message: 'Add meg a felhasználónevet!' }]} extra="3-32 karakter: betű, szám, pont, aláhúzás, kötőjel.">
            <Input maxLength={32} autoComplete="off" />
          </Form.Item>
          <Form.Item name="email" label="E-mail cím" rules={[{ required: true, type: 'email', message: 'Érvényes e-mail címet adj meg!' }]}>
            <Input type="email" autoComplete="off" />
          </Form.Item>
          <Form.Item name="role" label="Szerep">
            <Segmented options={[{ value: 'admin', label: 'Szervező' }, { value: 'customer', label: 'Játékos' }]} />
          </Form.Item>
          {createRole === 'admin' && (
            <Form.Item name="groupIds" label="Mit kezelhet?" extra="Később is módosítható a kártyán a „Jogosultságok” gombbal.">
              <GroupPicker groups={data.groups} isOwner={isOwner} />
            </Form.Item>
          )}
          <Text style={{ color: '#7d6e70', fontSize: 12 }}>A rendszer ideiglenes jelszót generál (7 napig érvényes). Első belépéskor saját jelszót kell beállítani.</Text>
        </Form>
      </Modal>

      {/* Ideiglenes jelszó megjelenítése */}
      <Modal title={modalTitle(credentials?.title || '')} open={!!credentials} onCancel={() => setCredentials(null)} footer={<Button type="primary" style={{ color: '#000', fontWeight: 'bold' }} onClick={() => setCredentials(null)}>Kész</Button>} closeIcon={closeIcon}>
        {credentials && (
          <div className="flex flex-col gap-3 pt-2">
            <Alert type="warning" showIcon message="Ezt az ideiglenes jelszót csak most látod. Másold ki, és juttasd el a felhasználónak." />
            <div className="rounded-lg p-3 flex flex-col gap-1" style={{ background: '#2a2022', border: '1px solid #2a2022' }}>
              <span style={{ color: '#baaaac' }}>Felhasználónév: <b style={{ color: '#E0D6C8' }}>{credentials.username}</b></span>
              <span style={{ color: '#baaaac' }}>Ideiglenes jelszó: <b style={{ color: '#E5B15D', fontFamily: 'monospace', fontSize: 16 }}>{credentials.tempPassword}</b></span>
              <span style={{ color: '#7d6e70', fontSize: 12 }}>Érvényes: {fmt(credentials.expiresAt)}-ig</span>
            </div>
            <Button icon={<CopyOutlined />} onClick={() => copy(`Felhasználónév: ${credentials.username}\nIdeiglenes jelszó: ${credentials.tempPassword}\nBelépés: ${window.location.origin}/admin`)}>Adatok másolása</Button>
          </div>
        )}
      </Modal>
    </ConfigProvider>
  );
}
