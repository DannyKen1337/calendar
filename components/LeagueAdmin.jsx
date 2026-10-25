"use client";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConfigProvider, Button, Modal, Form, Input, InputNumber, Select, Table, Tag, Popconfirm, Typography, Checkbox, Tabs, Segmented, message, Empty, Alert } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SettingOutlined, EyeOutlined, LinkOutlined, CloseOutlined, SearchOutlined, UserAddOutlined, TrophyOutlined, CloudUploadOutlined, FlagOutlined, UndoOutlined } from '@ant-design/icons';
import { tavernTheme } from '@/app/components';
import { getGameColor } from '@/lib/gameConfig';
import { STORE_NAMES } from '@/lib/permissions';
import Leaderboard, { formatPublishedAt } from '@/components/Leaderboard';
import {
  POINTS_MAX, LEAGUE_NAME_MAX, SESSION_TITLE_MAX,
  computeStandings, buildSnapshot, hasUnpublishedChanges, resultPoints, leagueUrl,
} from '@/lib/leagues';

const { Title, Text } = Typography;
const panel = 'bg-[#1a1012] p-4 rounded-xl border border-[#4A2E33]';
const sideBtn = { color: '#E0D6C8', borderColor: '#4A2E33', background: '#2B1A1C' };
const modalTitle = (t) => <span style={{ fontFamily: 'Georgia, serif', color: '#E5B15D' }}>{t}</span>;
const closeIcon = <CloseOutlined style={{ color: '#E5B15D' }} />;
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const formatDay = (s) => { const d = new Date(`${s}T12:00:00`); return isNaN(d) ? s : d.toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' }); };
const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
const storeNames = (stores) => stores.map(s => STORE_NAMES[s] || s).join(', ');
const STORE_OPTIONS = Object.entries(STORE_NAMES).map(([value, label]) => ({ value, label }));

// Az automatikus beemelés alapértelmezett boltja: a naptárban legutóbb kiválasztott bolt (ha nincs, mindegyik)
function lastSelectedStores() {
  try {
    const s = localStorage.getItem('tavern_selected_store');
    if (s && STORE_NAMES[s]) return [s];
  } catch { /* a böngésző letilthatja */ }
  return Object.keys(STORE_NAMES);
}

// A boltok, amelyek eseményeiről a jelentkezők automatikusan bekerülnek (liga létrehozásakor és a beállításokban)
const StoreInputs = () => (
  <Form.Item
    name="autoStores"
    label="Új játékosok automatikusan ezeknek a boltoknak az eseményeiről"
    extra="A liga játékának eseményeire jelentkezők (a várólistások és a lejelentkezettek nem) a szezon kezdetétől maguktól bekerülnek a játékosok közé. Pontot nem kapnak: a pontokat mindig ti írjátok be. Ha egy boltot sem jelölsz be, nincs automatikus beemelés."
  >
    <Checkbox.Group options={STORE_OPTIONS} />
  </Form.Item>
);

// Liga kezelése: játékonként egy liga. A játékosok a liga boltjainak eseményeiről automatikusan bekerülnek,
// a pontokat alkalmanként a szervező írja be. Piszkozat állás, előnézet és publikálás; a játékosok csak a publikált ranglistát látják.
export default function LeagueAdmin() {
  const [messageApi, contextHolder] = message.useMessage();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [game, setGame] = useState(null);
  const [tab, setTab] = useState('sessions');
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [playerEdit, setPlayerEdit] = useState(null);   // null: zárva; {}: új; {id,...}: szerkesztés
  const [sessionEdit, setSessionEdit] = useState(null); // null: zárva; { id?, date, title, tournamentId, points: {playerId: szám} }
  const [sessionQuery, setSessionQuery] = useState('');
  const [onlyEventPlayers, setOnlyEventPlayers] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false); // szezon lezárása ablak
  const [createForm] = Form.useForm();
  const [settingsForm] = Form.useForm();
  const [playerForm] = Form.useForm();
  const [closeForm] = Form.useForm();

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin-leagues', { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json || json.error) { setError((json && json.error) || 'Az adatok nem tölthetők be.'); return; }
      setError('');
      setData(json);
      setGame(g => g || json.leagues[0]?.category || json.games[0] || null);
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
      const res = await fetch('/api/admin-leagues', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType, payload }) });
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

  const league = data?.leagues.find(l => l.category === game) || null;
  const players = useMemo(() => (league ? data.players.filter(p => p.leagueId === league.id) : []), [data, league]);
  const sessions = useMemo(() => (league ? data.sessions.filter(s => s.leagueId === league.id) : []), [data, league]);
  const seasons = useMemo(() => (league ? (data.seasons || []).filter(s => s.leagueId === league.id) : []), [data, league]);
  const events = useMemo(() => (league ? (data.events || []).filter(e => e.leagueId === league.id) : []), [data, league]);
  const standings = useMemo(() => (league ? computeStandings(league.rules, players, sessions) : []), [league, players, sessions]);
  const snapshot = useMemo(() => buildSnapshot(standings, league?.published?.rows), [standings, league]);
  const statsById = useMemo(() => new Map(standings.map(s => [s.playerId, s])), [standings]);
  const unpublished = league ? hasUnpublishedChanges(snapshot, league.published?.rows) : false;

  if (error && !data) return <div className={panel}><Text style={{ color: '#ff7875' }}>{error}</Text></div>;
  if (!data) return <div className={panel}><Text style={{ color: '#baaaac' }}>Betöltés...</Text></div>;
  if (data.games.length === 0) return <div className={panel}><Empty description={<span style={{ color: '#baaaac' }}>Nincs olyan játék, amelynek a ligáját kezelheted.</span>} /></div>;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); messageApi.success('Link vágólapra másolva!'); }
    catch { messageApi.info({ content: text, duration: 10 }); }
  };
  const addedNote = (added) => (added ? ` ${added} játékos bekerült az eseményekről.` : '');

  // --- Műveletek ---
  const createLeague = async (values) => {
    const res = await post('CREATE_LEAGUE', { category: game, ...values });
    if (!res) return;
    messageApi.success(`Liga létrehozva.${addedNote(res.added)}`);
    setTab('players');
    load();
  };
  const openSettings = (stores) => {
    settingsForm.setFieldsValue({ name: league.name, autoStores: stores || league.autoStores || lastSelectedStores() });
    setSettingsOpen(true);
  };
  const saveSettings = async (values) => {
    const res = await post('UPDATE_LEAGUE', { id: league.id, ...values });
    if (!res) return;
    messageApi.success(`Beállítások mentve.${addedNote(res.added)}`);
    setSettingsOpen(false);
    load();
  };
  const clearIgnored = async () => {
    const res = await post('CLEAR_IGNORED', { leagueId: league.id });
    if (!res) return;
    messageApi.success(`A törölt játékosok újra bekerülhetnek.${addedNote(res.added)}`);
    setSettingsOpen(false);
    load();
  };
  const deleteLeague = async () => {
    if (!(await post('DELETE_LEAGUE', { id: league.id }))) return;
    messageApi.success('Liga törölve.');
    load();
  };
  const openPlayer = (p) => { setPlayerEdit(p); playerForm.resetFields(); playerForm.setFieldsValue({ fullName: p.fullName || '', nickname: p.nickname || '', email: p.email || '', riotId: p.riotId || '' }); };
  const savePlayer = async (values) => {
    if (!(await post('SAVE_PLAYER', { leagueId: league.id, id: playerEdit?.id, ...values }, playerForm))) return;
    messageApi.success(playerEdit?.id ? 'Játékos mentve.' : 'Játékos felvéve.');
    setPlayerEdit(null);
    load();
  };
  const deletePlayer = async (p) => {
    if (!(await post('DELETE_PLAYER', { id: p.id }))) return;
    messageApi.success('Játékos törölve.');
    load();
  };
  // A régi (győzelem / döntetlen / vereség alapú) eredmények a szerkesztőben a kiszámolt pontjukkal jelennek meg
  const openSession = (s) => {
    setSessionQuery('');
    setOnlyEventPlayers(true);
    setSessionEdit(s
      ? { id: s.id, date: s.date, title: s.title, tournamentId: s.tournamentId, points: Object.fromEntries(s.results.map(r => [r.playerId, resultPoints(r, league.rules)])) }
      : { date: todayStr(), title: '', tournamentId: null, points: {} });
  };
  const pickEvent = (id) => setSessionEdit(s => {
    const prev = events.find(e => e.id === s.tournamentId);
    const e = events.find(x => x.id === id);
    // A megnevezést és a dátumot az eseményből vesszük, ha még nem írtak be mást
    const titleFree = !s.title || (prev && s.title === prev.name.slice(0, SESSION_TITLE_MAX));
    return { ...s, tournamentId: id || null, ...(e ? { date: String(e.date).slice(0, 10), ...(titleFree ? { title: e.name.slice(0, SESSION_TITLE_MAX) } : {}) } : {}) };
  });
  const setPoints = (playerId, value) => setSessionEdit(s => {
    const next = { ...s.points };
    if (Number.isInteger(value)) next[playerId] = value; else delete next[playerId];
    return { ...s, points: next };
  });
  const saveSession = async () => {
    if (!sessionEdit.date) { messageApi.error('Adj meg dátumot.'); return; }
    const results = Object.entries(sessionEdit.points).map(([playerId, points]) => ({ playerId, points }));
    if (!(await post('SAVE_SESSION', { leagueId: league.id, id: sessionEdit.id, date: sessionEdit.date, title: sessionEdit.title, tournamentId: sessionEdit.tournamentId, results }))) return;
    messageApi.success('Alkalom mentve. A ranglista a publikáláskor frissül.');
    setSessionEdit(null);
    load();
  };
  const deleteSession = async (s) => {
    if (!(await post('DELETE_SESSION', { id: s.id }))) return;
    messageApi.success('Alkalom törölve.');
    load();
  };
  const closeSeason = async (values) => {
    if (!(await post('CLOSE_SEASON', { leagueId: league.id, newName: values.newName, keepPlayers: values.keepPlayers }))) return;
    messageApi.success('Szezon lezárva és archiválva. Az új szezon ranglistája az első publikáláskor jelenik meg.');
    setCloseOpen(false);
    setTab('seasons');
    load();
  };
  const deleteSeason = async (s) => {
    if (!(await post('DELETE_SEASON', { id: s.id }))) return;
    messageApi.success('Archív szezon törölve.');
    load();
  };

  const publish = async () => {
    const res = await post('PUBLISH', { leagueId: league.id });
    if (!res) return;
    messageApi.success('Ranglista publikálva.');
    setPreviewOpen(false);
    load();
  };

  // --- Játékválasztó ---
  const gamePicker = (
    <div className={`${panel} flex flex-wrap items-center gap-3`}>
      <Text style={{ color: '#baaaac' }}>Játék:</Text>
      <Segmented
        value={game}
        onChange={(g) => { setGame(g); setTab('sessions'); }}
        options={data.games.map(g => ({
          value: g,
          label: <span className="flex items-center gap-2"><span style={{ width: 8, height: 8, borderRadius: '50%', background: getGameColor({ category: g }), display: 'inline-block', opacity: data.leagues.some(l => l.category === g) ? 1 : 0.3 }} />{g}</span>,
        }))}
        style={{ flexWrap: 'wrap', maxWidth: '100%' }}
      />
    </div>
  );

  // --- Nincs még liga ennél a játéknál ---
  if (!league) {
    return (
      <ConfigProvider theme={tavernTheme}>
        {contextHolder}
        <div className="flex flex-col gap-4">
          {gamePicker}
          <div className={panel}>
            <Title level={4} style={{ color: '#E5B15D', fontFamily: 'Georgia, serif', marginTop: 0 }}>Liga létrehozása: {game}</Title>
            <Text style={{ color: '#9a8a8c', display: 'block', marginBottom: 16 }}>Játékonként egy liga lehet. A játékosok a kiválasztott boltok eseményeiről maguktól bekerülnek, a pontokat pedig alkalmanként ti írjátok be.</Text>
            <Form key={game} form={createForm} layout="vertical" requiredMark={false} onFinish={createLeague} initialValues={{ name: `${game} liga`, autoStores: lastSelectedStores() }} style={{ maxWidth: 640 }}>
              <Form.Item name="name" label="Liga neve" rules={[{ required: true, whitespace: true, message: 'Add meg a liga nevét!' }]}>
                <Input maxLength={LEAGUE_NAME_MAX} placeholder="Pl.: Pokémon liga – 2026 ősz" />
              </Form.Item>
              <StoreInputs />
              <Button type="primary" htmlType="submit" loading={busy} icon={<TrophyOutlined />} style={{ color: '#000', fontWeight: 'bold' }}>Liga létrehozása</Button>
            </Form>
          </div>
        </div>
      </ConfigProvider>
    );
  }

  // --- Táblázatok ---
  const playerColumns = [
    { title: 'Becenév', dataIndex: 'nickname', render: (t) => <span style={{ color: '#E5B15D', fontWeight: 'bold' }}>{t}</span>, sorter: (a, b) => a.nickname.localeCompare(b.nickname, 'hu') },
    { title: 'Teljes név', dataIndex: 'fullName', render: (t) => (t ? <span style={{ color: '#E0D6C8' }}>{t}</span> : <span style={{ color: '#6b7280' }}>—</span>) },
    { title: 'E-mail / Riot-azonosító', key: 'contact', render: (_, p) => (
      <span className="flex flex-col">
        {p.email && <a href={`mailto:${p.email}`} style={{ color: '#baaaac' }}>{p.email}</a>}
        {p.riotId && <span style={{ color: '#E0D6C8', whiteSpace: 'nowrap' }}>{p.riotId}</span>}
        {!p.email && !p.riotId && <span style={{ color: '#6b7280' }}>—</span>}
      </span>
    ) },
    { title: 'Honnan', dataIndex: 'source', render: (s) => (s === 'rgn' ? <Tag color="blue">Riftbound oldal</Tag> : s === 'event' ? <Tag color="green">Eseményről</Tag> : <Tag>Kézzel</Tag>), filters: [{ text: 'Eseményről', value: 'event' }, { text: 'Riftbound oldal', value: 'rgn' }, { text: 'Kézzel', value: 'manual' }], onFilter: (v, p) => p.source === v },
    { title: 'Jelentkezés', key: 'events', align: 'right', render: (_, p) => p.eventIds.length, sorter: (a, b) => a.eventIds.length - b.eventIds.length },
    { title: 'Alkalom', key: 'sessions', align: 'right', render: (_, p) => statsById.get(p.id)?.sessions ?? 0 },
    { title: 'Pont', key: 'points', align: 'right', render: (_, p) => <b style={{ color: '#E0D6C8' }}>{statsById.get(p.id)?.points ?? 0}</b>, sorter: (a, b) => (statsById.get(a.id)?.points ?? 0) - (statsById.get(b.id)?.points ?? 0) },
    { title: '', key: 'actions', width: 96, render: (_, p) => (
      <span className="flex">
        <Button type="text" icon={<EditOutlined />} onClick={() => openPlayer(p)} aria-label="Szerkesztés" style={{ color: '#E0D6C8' }} />
        <Popconfirm title="Törlöd a játékost?" description="Az alkalmakból is törlődnek a pontjai, és az eseményekről sem kerül vissza automatikusan." onConfirm={() => deletePlayer(p)} okText="Törlés" cancelText="Mégse" okButtonProps={{ danger: true }}>
          <Button type="text" danger icon={<DeleteOutlined />} aria-label="Törlés" />
        </Popconfirm>
      </span>
    ) },
  ];

  const sessionColumns = [
    { title: 'Dátum', dataIndex: 'date', render: (d) => <span style={{ color: '#E0D6C8', whiteSpace: 'nowrap' }}>{formatDay(d)}</span> },
    { title: 'Megnevezés', dataIndex: 'title', render: (t) => <span style={{ color: '#baaaac' }}>{t || '—'}</span> },
    { title: 'Játékos', key: 'att', align: 'right', render: (_, s) => s.results.length },
    { title: 'Kiosztott pont', key: 'pts', align: 'right', render: (_, s) => s.results.reduce((sum, r) => sum + resultPoints(r, league.rules), 0) },
    { title: '', key: 'actions', width: 96, render: (_, s) => (
      <span className="flex">
        <Button type="text" icon={<EditOutlined />} onClick={() => openSession(s)} aria-label="Szerkesztés" style={{ color: '#E0D6C8' }} />
        <Popconfirm title="Törlöd ezt az alkalmat?" description="A benne kiosztott pontok is törlődnek." onConfirm={() => deleteSession(s)} okText="Törlés" cancelText="Mégse" okButtonProps={{ danger: true }}>
          <Button type="text" danger icon={<DeleteOutlined />} aria-label="Törlés" />
        </Popconfirm>
      </span>
    ) },
  ];

  const standingColumns = [
    { title: '#', dataIndex: 'rank', width: 50 },
    { title: 'Becenév', dataIndex: 'nickname', render: (t) => <span style={{ color: '#E5B15D', fontWeight: 'bold' }}>{t}</span> },
    { title: 'Pont', dataIndex: 'points', align: 'right', render: (p) => <b style={{ color: '#E0D6C8' }}>{p}</b> },
    { title: 'Publikálás óta', dataIndex: 'delta', align: 'right', render: (d) => <span style={{ color: d > 0 ? '#8fd18f' : d < 0 ? '#ff9b9b' : '#6f6466' }}>{signed(d)}</span> },
    { title: 'Alkalom', dataIndex: 'sessions', align: 'right' },
  ];

  // --- Alkalom szerkesztő sorai: az esemény jelentkezői elöl, aztán akinek már van pontja, végül a többiek ---
  const selectedEvent = sessionEdit?.tournamentId ? events.find(e => e.id === sessionEdit.tournamentId) || { id: sessionEdit.tournamentId, name: 'Korábbi esemény', date: sessionEdit.date } : null;
  const inEvent = (p) => !!selectedEvent && p.eventIds.includes(selectedEvent.id);
  const q = sessionQuery.trim().toLowerCase();
  const editorRows = sessionEdit ? players
    .filter(p => !q || `${p.nickname} ${p.fullName} ${p.riotId || ''}`.toLowerCase().includes(q))
    .filter(p => q || !selectedEvent || !onlyEventPlayers || inEvent(p) || Number.isInteger(sessionEdit.points[p.id]))
    .sort((a, b) => (inEvent(b) - inEvent(a)) || (Number.isInteger(sessionEdit.points[b.id]) - Number.isInteger(sessionEdit.points[a.id])) || a.nickname.localeCompare(b.nickname, 'hu'))
    : [];
  const editorColumns = sessionEdit ? [
    { title: 'Játékos', key: 'name', render: (_, p) => (
      <div>
        <div className="flex flex-wrap items-center gap-2"><span style={{ color: '#E5B15D', fontWeight: 'bold' }}>{p.nickname}</span>{inEvent(p) && <Tag color="green" style={{ margin: 0 }}>jelentkezett</Tag>}</div>
        <div style={{ color: '#9a8a8c', fontSize: 12 }}>{[p.fullName, p.riotId].filter(Boolean).join(' · ')}</div>
      </div>
    ) },
    { title: 'Pont', key: 'points', width: 140, render: (_, p) => (
      <InputNumber size="middle" min={-POINTS_MAX} max={POINTS_MAX} precision={0} value={sessionEdit.points[p.id] ?? null} placeholder="—" onChange={(v) => setPoints(p.id, v)} style={{ width: 110 }} aria-label={`${p.nickname} pontja`} />
    ) },
  ] : [];
  const editorValues = sessionEdit ? Object.values(sessionEdit.points) : [];
  const editorTotal = editorValues.reduce((s, v) => s + v, 0);

  const changed = snapshot.filter(r => r.delta !== 0).length;
  const autoInfo = league.autoStores === null
    ? null
    : league.autoStores.length
      ? `Új játékosok automatikusan: ${storeNames(league.autoStores)} eseményeiről, ${formatDay(league.seasonStart)} óta`
      : 'Automatikus beemelés kikapcsolva';

  return (
    <ConfigProvider theme={tavernTheme}>
      {contextHolder}
      <div className="flex flex-col gap-4">
        {gamePicker}

        {/* Liga fejléc: állapot és publikálás */}
        <div className={`${panel} flex flex-col gap-3`} style={{ borderLeft: `5px solid ${getGameColor({ category: league.category })}` }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Title level={3} style={{ margin: 0, color: '#E0D6C8', fontFamily: 'Georgia, serif' }}>{league.name}</Title>
              {autoInfo && <Text style={{ color: '#9a8a8c', fontSize: 13 }}>{autoInfo}</Text>}
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {league.published
                  ? <Text style={{ color: '#baaaac', fontSize: 13 }}>Utoljára publikálva: {formatPublishedAt(league.published.at)}{league.published.by ? ` (${league.published.by})` : ''}</Text>
                  : <Tag color="default" style={{ margin: 0 }}>Még nincs publikálva</Tag>}
                {unpublished && <Tag color="gold" style={{ margin: 0 }}>Nem publikált változások</Tag>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="primary" icon={<EyeOutlined />} style={{ color: '#000', fontWeight: 'bold' }} onClick={() => setPreviewOpen(true)}>Előnézet és publikálás</Button>
              <Button icon={<LinkOutlined />} style={sideBtn} onClick={() => copy(`${origin}${leagueUrl(league.category)}`)} disabled={!league.published && seasons.length === 0}>Link másolása</Button>
              <Button icon={<EyeOutlined />} style={sideBtn} onClick={() => window.open(leagueUrl(league.category), '_blank', 'noopener')} disabled={!league.published && seasons.length === 0}>Nyilvános oldal</Button>
              <Button icon={<SettingOutlined />} style={sideBtn} onClick={() => openSettings()}>Beállítások</Button>
              <Button icon={<FlagOutlined />} style={sideBtn} disabled={sessions.length === 0} title={sessions.length === 0 ? 'Nincs még rögzített alkalom' : 'A szezon végeredményének archiválása és új szezon indítása'} onClick={() => { closeForm.resetFields(); closeForm.setFieldsValue({ newName: '', keepPlayers: true }); setCloseOpen(true); }}>Szezon lezárása</Button>
            </div>
          </div>
          {league.autoStores === null && (
            <Alert
              type="info"
              showIcon
              message="Az új játékosok automatikusan is bekerülhetnek"
              description={`Válaszd ki, melyik bolt ${league.category} eseményeiről kerüljenek be a jelentkezők (a szezon kezdetétől). Pontot nem kapnak, azt továbbra is ti írjátok be.`}
              action={<Button size="small" type="primary" style={{ color: '#000', fontWeight: 'bold' }} onClick={() => openSettings(lastSelectedStores())}>Beállítás</Button>}
            />
          )}
        </div>

        <div className={panel}>
          <Tabs
            activeKey={tab}
            onChange={setTab}
            items={[
              {
                key: 'sessions',
                label: `Alkalmak (${sessions.length})`,
                children: (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Text style={{ color: '#9a8a8c', fontSize: 13 }}>Alkalmanként írd be, ki hány pontot kapott. Akinél üresen hagyod, az nem vett részt.</Text>
                      <Button type="primary" icon={<PlusOutlined />} style={{ color: '#000', fontWeight: 'bold' }} onClick={() => openSession(null)} disabled={players.length === 0}>Új alkalom</Button>
                    </div>
                    {players.length === 0 && <Text style={{ color: '#faad14' }}>Még nincs játékos. Az eseményekre jelentkezők maguktól bekerülnek, vagy a „Játékosok” fülön kézzel is felvehetsz valakit.</Text>}
                    <Table size="small" dataSource={sessions} rowKey="id" columns={sessionColumns} pagination={sessions.length > 15 ? { pageSize: 15 } : false} scroll={{ x: 600 }} locale={{ emptyText: <span style={{ color: '#6b7280' }}>Még nincs rögzített alkalom.</span> }} />
                  </div>
                ),
              },
              {
                key: 'players',
                label: `Játékosok (${players.length})`,
                children: (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Text style={{ color: '#9a8a8c', fontSize: 13 }}>A ranglistán csak a becenév látszik, és csak az kerül fel, akinek már van pontja. A teljes nevet, az e-mail címet és a Riot-azonosítót csak a szervezők látják.</Text>
                      <Button type="primary" icon={<UserAddOutlined />} style={{ color: '#000', fontWeight: 'bold' }} onClick={() => openPlayer({})}>Új játékos</Button>
                    </div>
                    <Table size="small" dataSource={players} rowKey="id" columns={playerColumns} pagination={players.length > 25 ? { pageSize: 25 } : false} scroll={{ x: 820 }} locale={{ emptyText: <span style={{ color: '#6b7280' }}>Még nincs játékos.</span> }} />
                  </div>
                ),
              },
              {
                key: 'standings',
                label: 'Állás (piszkozat)',
                children: (
                  <div className="flex flex-col gap-3">
                    <Text style={{ color: '#9a8a8c', fontSize: 13 }}>Ez a jelenlegi, még nem feltétlenül publikált állás. A „Publikálás óta” oszlop mutatja, ki hány pontot kap a következő publikáláskor.</Text>
                    <Table size="small" dataSource={snapshot} rowKey="playerId" columns={standingColumns} pagination={false} scroll={{ x: 480 }} locale={{ emptyText: <span style={{ color: '#6b7280' }}>Még senkinek nincs pontja.</span> }} />
                  </div>
                ),
              },
              {
                key: 'seasons',
                label: `Korábbi szezonok (${seasons.length})`,
                children: (
                  <div className="flex flex-col gap-3">
                    <Text style={{ color: '#9a8a8c', fontSize: 13 }}>A lezárt szezonok végeredménye a nyilvános oldalon is visszanézhető. Csak becenevek szerepelnek benne.</Text>
                    <Table size="small" dataSource={seasons} rowKey="id" pagination={false} scroll={{ x: 640 }} locale={{ emptyText: <span style={{ color: '#6b7280' }}>Még nincs lezárt szezon.</span> }} columns={[
                      { title: 'Szezon', dataIndex: 'name', render: (t) => <span style={{ color: '#E5B15D', fontWeight: 'bold' }}>{t}</span> },
                      { title: 'Lezárva', dataIndex: 'closedAt', render: (d, s) => <span style={{ color: '#baaaac', whiteSpace: 'nowrap' }}>{formatPublishedAt(d)}{s.closedBy ? ` (${s.closedBy})` : ''}</span> },
                      { title: 'Győztes', dataIndex: 'winners', render: (w) => <span style={{ color: '#E0D6C8' }}>{w.join(', ') || '—'}</span> },
                      { title: 'Játékos', dataIndex: 'players', align: 'right' },
                      { title: '', key: 'actions', width: 96, render: (_, s) => (
                        <span className="flex">
                          <Button type="text" icon={<EyeOutlined />} aria-label="Megnyitás" style={{ color: '#E0D6C8' }} onClick={() => window.open(`${leagueUrl(league.category)}?szezon=${encodeURIComponent(s.id)}`, '_blank', 'noopener')} />
                          <Popconfirm title="Törlöd ezt az archív szezont?" description="A végeredménye a nyilvános oldalról is eltűnik." onConfirm={() => deleteSeason(s)} okText="Törlés" cancelText="Mégse" okButtonProps={{ danger: true }}>
                            <Button type="text" danger icon={<DeleteOutlined />} aria-label="Törlés" />
                          </Popconfirm>
                        </span>
                      ) },
                    ]} />
                  </div>
                ),
              },
            ]}
          />
        </div>

        <div className={`${panel} flex flex-wrap items-center justify-between gap-2`}>
          <Text style={{ color: '#7d6e70', fontSize: 12 }}>A liga törlésekor a játékosai és az alkalmai is véglegesen törlődnek, a nyilvános ranglista eltűnik.</Text>
          <Popconfirm title="Biztosan törlöd a ligát?" description="A játékosok, az alkalmak és a ranglista is törlődik." onConfirm={deleteLeague} okText="Törlés" cancelText="Mégse" okButtonProps={{ danger: true }}>
            <Button danger size="small" icon={<DeleteOutlined />}>Liga törlése</Button>
          </Popconfirm>
        </div>
      </div>

      {/* Előnézet: pontosan ez kerül ki a nyilvános oldalra */}
      <Modal
        title={modalTitle('Előnézet – így látják a játékosok')}
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        width={720}
        closeIcon={closeIcon}
        footer={[
          <Button key="cancel" onClick={() => setPreviewOpen(false)}>Mégse</Button>,
          <Button key="publish" type="primary" icon={<CloudUploadOutlined />} loading={busy} onClick={publish} style={{ color: '#000', fontWeight: 'bold' }}>Publikálás</Button>,
        ]}
      >
        <div className="flex flex-col gap-3 pt-2">
          <Text style={{ color: '#baaaac' }}>
            {league.published
              ? (unpublished ? `${changed} játékos pontja változik a legutóbbi publikálás óta.` : 'Nincs változás a legutóbbi publikálás óta. Publikáláskor mindenkinél „+0 pont” jelenik meg.')
              : 'Ez lesz az első publikálás: mindenki mellett az eddigi összes pontja jelenik meg.'}
          </Text>
          <Leaderboard league={league} rows={snapshot} publishedAt={new Date().toISOString()} compact />
        </div>
      </Modal>

      {/* Szezon lezárása: a végeredmény előnézete, az új szezon neve */}
      <Modal
        title={modalTitle('Szezon lezárása')}
        open={closeOpen}
        onCancel={() => setCloseOpen(false)}
        onOk={() => closeForm.submit()}
        okText="Szezon lezárása"
        cancelText="Mégse"
        confirmLoading={busy}
        okButtonProps={{ danger: true }}
        width={720}
        closeIcon={closeIcon}
        forceRender
      >
        <div className="flex flex-col gap-3 pt-2">
          <Text style={{ color: '#baaaac' }}>
            Ez lesz a(z) „{league.name}” végeredménye. Lezárás után archiválódik, és a nyilvános oldalon visszanézhető. Az alkalmak törlődnek, az új szezon nulláról indul, a ranglistája pedig az első publikáláskor jelenik meg. Az új szezonba a lezárás után tartott eseményekre jelentkezők kerülnek be automatikusan.
          </Text>
          <Leaderboard league={league} rows={snapshot} compact hideDelta subtitle="Végeredmény (előnézet)" />
          <Form form={closeForm} layout="vertical" requiredMark={false} onFinish={closeSeason}>
            <Form.Item name="newName" label="Az új szezon neve" rules={[{ required: true, whitespace: true, message: 'Add meg az új szezon nevét!' }]} extra="Pl.: Pokémon liga – 2027 tavasz">
              <Input maxLength={LEAGUE_NAME_MAX} />
            </Form.Item>
            <Form.Item name="keepPlayers" valuePropName="checked" style={{ marginBottom: 0 }} extra="Ha kiveszed a pipát, a játékosok adatai (teljes név, e-mail) is törlődnek; az új szezonban az eseményekre jelentkezők újra bekerülnek.">
              <Checkbox>Játékosok megtartása az új szezonra</Checkbox>
            </Form.Item>
          </Form>
        </div>
      </Modal>

      {/* Liga beállításai */}
      <Modal title={modalTitle('Liga beállításai')} open={settingsOpen} onCancel={() => setSettingsOpen(false)} onOk={() => settingsForm.submit()} okText="Mentés" cancelText="Mégse" confirmLoading={busy} okButtonProps={{ style: { color: '#000', fontWeight: 'bold' } }} closeIcon={closeIcon} forceRender width={600}>
        <Form form={settingsForm} layout="vertical" requiredMark={false} onFinish={saveSettings} className="mt-4">
          <Form.Item name="name" label="Liga neve" rules={[{ required: true, whitespace: true, message: 'Add meg a liga nevét!' }]}>
            <Input maxLength={LEAGUE_NAME_MAX} />
          </Form.Item>
          <StoreInputs />
        </Form>
        {league.ignoredCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ background: '#2B1A1C', border: '1px solid #4A2E33' }}>
            <Text style={{ color: '#baaaac', fontSize: 13 }}>A törölt játékosok nem kerülnek vissza automatikusan az eseményekről.</Text>
            <Popconfirm title="Visszaengeded a törölt játékosokat?" description="Ha jelentkeztek a liga eseményeire, újra bekerülnek (pont nélkül)." onConfirm={clearIgnored} okText="Igen" cancelText="Mégse">
              <Button size="small" icon={<UndoOutlined />} style={sideBtn}>Visszaengedés</Button>
            </Popconfirm>
          </div>
        )}
      </Modal>

      {/* Játékos felvétele / szerkesztése */}
      <Modal title={modalTitle(playerEdit?.id ? 'Játékos szerkesztése' : 'Új játékos')} open={playerEdit !== null} onCancel={() => setPlayerEdit(null)} onOk={() => playerForm.submit()} okText={playerEdit?.id ? 'Mentés' : 'Felvétel'} cancelText="Mégse" confirmLoading={busy} okButtonProps={{ style: { color: '#000', fontWeight: 'bold' } }} closeIcon={closeIcon} forceRender zIndex={1100}>
        <Form form={playerForm} layout="vertical" requiredMark={false} onFinish={savePlayer} className="mt-4">
          <Form.Item name="fullName" label="Teljes név" dependencies={['riotId']} rules={[({ getFieldValue }) => ({ required: !['event', 'rgn'].includes(playerEdit?.source) && !String(getFieldValue('riotId') || '').trim(), whitespace: true, message: 'Add meg a teljes nevet!' })]} extra="Csak a szervezők látják. Eseményről beemelt vagy Riot-azonosítóval felvett játékosnál nem kötelező.">
            <Input maxLength={120} placeholder="Vezetéknév Keresztnév" autoComplete="off" />
          </Form.Item>
          <Form.Item name="nickname" label="Becenév" rules={[{ required: true, whitespace: true, message: 'Add meg a becenevet!' }, { min: 2, max: 24, message: '2-24 karakter' }]} extra="Ez látszik a ranglistán.">
            <Input maxLength={24} placeholder="Pl.: PikaMester" autoComplete="off" />
          </Form.Item>
          <Form.Item name="email" label="E-mail cím" dependencies={['riotId']} rules={[({ getFieldValue }) => ({ required: !['event', 'rgn'].includes(playerEdit?.source) && !String(getFieldValue('riotId') || '').trim(), type: 'email', message: 'Érvényes e-mail címet adj meg!' })]} extra="Csak a szervezők látják. Egy ligában egy e-mail címmel egy játékos lehet; az eseményekre jelentkezőket ez alapján ismeri fel a rendszer. Ha a játékos 12 hónapig egy alkalmon sem vesz részt, az adatai automatikusan törlődnek.">
            <Input type="email" placeholder="nev@pelda.hu" autoComplete="off" />
          </Form.Item>
          <Form.Item name="riotId" label="Riot-azonosító (nem kötelező)" extra="Név#TAG formában, pl. Flagger#7777. A Riftbound oldalas események jelentkezőit ez alapján ismeri fel a rendszer.">
            <Input maxLength={52} placeholder="Név#TAG" autoComplete="off" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Alkalom rögzítése: játékosonként a pont */}
      <Modal
        title={modalTitle(sessionEdit?.id ? 'Alkalom szerkesztése' : 'Új alkalom')}
        open={sessionEdit !== null}
        onCancel={() => setSessionEdit(null)}
        width={760}
        closeIcon={closeIcon}
        footer={sessionEdit && [
          <span key="sum" style={{ color: '#9a8a8c', marginRight: 12 }}>{editorValues.length} játékos · {editorTotal} pont összesen</span>,
          <Button key="cancel" onClick={() => setSessionEdit(null)}>Mégse</Button>,
          <Button key="save" type="primary" loading={busy} onClick={saveSession} style={{ color: '#000', fontWeight: 'bold' }}>Mentés</Button>,
        ]}
      >
        {sessionEdit && (
          <div className="flex flex-col gap-3 pt-2">
            <label className="flex flex-col gap-1">
              <span style={{ color: '#baaaac', fontSize: 13 }}>Esemény (nem kötelező)</span>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Válaszd ki az eseményt, a jelentkezői kerülnek előre..."
                value={sessionEdit.tournamentId}
                onChange={(v) => pickEvent(v ?? null)}
                options={[
                  ...(selectedEvent && !events.some(e => e.id === selectedEvent.id) ? [{ value: selectedEvent.id, label: selectedEvent.name }] : []),
                  ...events.map(e => ({ value: e.id, label: `${formatDay(String(e.date).slice(0, 10))} ${String(e.date).slice(11, 16)} – ${e.name} (${STORE_NAMES[e.store] || e.store}, ${players.filter(p => p.eventIds.includes(e.id)).length} jelentkező)` })),
                ]}
                notFoundContent={<span style={{ color: '#6b7280' }}>Nincs esemény a szezonban.</span>}
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col gap-1">
                <span style={{ color: '#baaaac', fontSize: 13 }}>Dátum</span>
                <Input type="date" value={sessionEdit.date} onChange={(e) => setSessionEdit(s => ({ ...s, date: e.target.value }))} style={{ width: 180 }} />
              </label>
              <label className="flex flex-col gap-1 flex-1 min-w-[220px]">
                <span style={{ color: '#baaaac', fontSize: 13 }}>Megnevezés (nem kötelező)</span>
                <Input value={sessionEdit.title} maxLength={SESSION_TITLE_MAX} onChange={(e) => setSessionEdit(s => ({ ...s, title: e.target.value }))} placeholder="Pl.: 3. forduló" />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input allowClear prefix={<SearchOutlined style={{ color: '#E5B15D' }} />} placeholder="Játékos keresése..." value={sessionQuery} onChange={(e) => setSessionQuery(e.target.value)} style={{ maxWidth: 260 }} />
              {selectedEvent && <Checkbox checked={onlyEventPlayers} onChange={(e) => setOnlyEventPlayers(e.target.checked)}>Csak az esemény jelentkezői</Checkbox>}
              <Button icon={<UserAddOutlined />} style={sideBtn} onClick={() => openPlayer({})}>Új játékos</Button>
            </div>
            <Text style={{ color: '#7d6e70', fontSize: 12 }}>Írd be a pontot (0 is lehet, levonásnál negatív). Akinél üresen marad, az nem vett részt ezen az alkalmon.</Text>
            <Table size="small" dataSource={editorRows} rowKey="id" columns={editorColumns} pagination={false} scroll={{ y: 420 }} locale={{ emptyText: <span style={{ color: '#6b7280' }}>{selectedEvent && onlyEventPlayers && !q ? 'Erre az eseményre még nincs beemelt jelentkező.' : 'Nincs találat.'}</span> }} />
          </div>
        )}
      </Modal>
    </ConfigProvider>
  );
}
