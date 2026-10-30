"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfigProvider, Tabs, Table, Tag, Input, Select, DatePicker, Button, Tooltip, Empty, Typography, message } from 'antd';
import { CheckCircleFilled, WarningFilled, CloseCircleFilled, QuestionCircleFilled, InfoCircleFilled, ReloadOutlined, DownloadOutlined, SearchOutlined, LinkOutlined } from '@ant-design/icons';
import { adminTheme } from '@/components/AdminPage';
import { STORE_NAMES } from '@/lib/permissions';
import useLiveRefresh from '@/lib/useLiveRefresh';

const { Text } = Typography;
const { RangePicker } = DatePicker;

// Tulajdonosi Rendszer oldal: áttekintés (mi működik, mikor futott utoljára) és a teljes tevékenységnapló

const panel = 'bg-[#191314] p-4 rounded-xl border border-[#2a2022]';
const panelTitle = { color: '#f3ece3', margin: '0 0 12px 0', fontWeight: 800, fontSize: 18 };
const muted = { color: '#9a8a8c', fontSize: 13 };
// Állapotszínek: mindig ikonnal és szöveggel együtt (soha nem csak szín)
const STATUS = {
  ok: { color: '#3fb27f', icon: <CheckCircleFilled />, label: 'Működik' },
  late: { color: '#e0a030', icon: <WarningFilled />, label: 'Késik' },
  warn: { color: '#e0a030', icon: <WarningFilled />, label: 'Figyelmeztetés' },
  error: { color: '#e5534b', icon: <CloseCircleFilled />, label: 'Hiba' },
  unknown: { color: '#8a7f80', icon: <QuestionCircleFilled />, label: 'Még nem futott' },
  info: { color: '#8a9bd6', icon: <InfoCircleFilled />, label: 'Infó' },
  off: { color: '#8a7f80', icon: <InfoCircleFilled />, label: 'Nincs beállítva' },
};
const BAR_COLOR = '#B8822F';

const fmt = (d) => (d ? new Date(d).toLocaleString('hu-HU', { timeZone: 'Europe/Budapest', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–');
const fmtFull = (d) => (d ? new Date(d).toLocaleString('hu-HU', { timeZone: 'Europe/Budapest', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '–');
function ago(d, now) {
  if (!d) return 'soha';
  const s = Math.max(0, Math.round((now - new Date(d).getTime()) / 1000));
  if (s < 60) return 'épp most';
  if (s < 3600) return `${Math.floor(s / 60)} perce`;
  if (s < 86400) return `${Math.floor(s / 3600)} órája`;
  return `${Math.floor(s / 86400)} napja`;
}
const duration = (ms) => (ms == null ? '' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} mp`);
const eventDate = (s) => (s ? s.replace('T', ' ').slice(5, 16).replace('-', '.') : '');

function StatusBadge({ status, label }) {
  const s = STATUS[status] || STATUS.unknown;
  return <span style={{ color: s.color, fontWeight: 600, whiteSpace: 'nowrap' }} className="inline-flex items-center gap-1.5">{s.icon}{label || s.label}</span>;
}

// Felső állapotcsempe: egy rendszerrész egy pillantásra
function StatusTile({ title, status, label, detail }) {
  const s = STATUS[status] || STATUS.unknown;
  return (
    <div className="bg-[#2a2022] rounded-lg border px-4 py-3" style={{ borderColor: status === 'error' ? '#7a2d2d' : status === 'late' || status === 'warn' ? '#6b5020' : '#2a2022' }}>
      <div style={{ color: '#baaaac', fontSize: 13 }}>{title}</div>
      <div style={{ color: s.color, fontSize: 18, fontWeight: 700 }} className="flex items-center gap-2 mt-0.5">{s.icon}{label || s.label}</div>
      {detail && <div style={{ color: '#8a7f80', fontSize: 12, marginTop: 2 }}>{detail}</div>}
    </div>
  );
}

const NumberTile = ({ label, value, hint }) => (
  <div className="bg-[#2a2022] rounded-lg border border-[#2a2022] px-3 py-2">
    <div style={{ color: '#E0D6C8', fontSize: 22, fontWeight: 'bold', lineHeight: 1.2 }}>{value}</div>
    <div style={{ color: '#baaaac', fontSize: 12 }}>{label}</div>
    {hint && <div style={{ color: '#7d6e70', fontSize: 11 }}>{hint}</div>}
  </div>
);

// Napi aktivitás (naplóbejegyzések száma) az elmúlt 14 napban; oszloponként súgó a pontos értékkel
function ActivityChart({ days }) {
  const max = Math.max(1, ...days.map(d => d.count));
  const total = days.reduce((s, d) => s + d.count, 0);
  const dayLabel = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
  return (
    <div>
      <div style={muted} className="mb-2">Naplóbejegyzések naponta · összesen {total} az elmúlt 14 napban</div>
      <div className="flex items-end gap-[2px]" style={{ height: 110, borderBottom: '1px solid #2a2022' }} role="img" aria-label={`Napi aktivitás: ${days.map(d => `${dayLabel(d.day)}: ${d.count}`).join(', ')}`}>
        {days.map(d => (
          <Tooltip key={d.day} title={`${dayLabel(d.day)}: ${d.count} bejegyzés`}>
            <div className="flex-1 h-full flex items-end cursor-default group">
              <div className="w-full group-hover:opacity-80" style={{ height: d.count ? `${Math.max(3, (d.count / max) * 100)}%` : 0, background: BAR_COLOR, borderRadius: '4px 4px 0 0' }} />
            </div>
          </Tooltip>
        ))}
      </div>
      <div className="flex justify-between mt-1" style={{ color: '#7d6e70', fontSize: 11 }}>
        <span>{dayLabel(days[0].day)}</span><span>{dayLabel(days[days.length - 1].day)}</span>
      </div>
    </div>
  );
}

const runDetails = (details) => {
  if (!details) return '';
  const parts = [];
  if (details.synced != null) parts.push(`${details.synced} esemény frissítve`);
  if (details.leaguePlayers) parts.push(`${details.leaguePlayers} új ligajátékos`);
  if (details.deletedCount != null) parts.push(`${details.deletedCount} régi esemény törölve`);
  if (details.preorderProducts) parts.push(`${details.preorderProducts} lejárt előrendelés`);
  if (details.leaguePlayers) parts.push(`${details.leaguePlayers} inaktív ligajátékos`);
  return parts.join(' · ');
};

function Overview({ data, onRefresh, refreshing }) {
  const now = data.serverTime;
  const [openError, setOpenError] = useState(null);
  const failingRequired = data.integrations.filter(i => !i.ok && !i.optional);
  const jobStatus = data.jobs.some(j => j.status === 'error') ? 'error' : data.jobs.some(j => j.status === 'late') ? 'late' : data.jobs.every(j => j.status === 'unknown') ? 'unknown' : 'ok';
  const rgnStatus = !data.rgn.events.length ? 'info' : data.rgn.failed ? 'error' : data.rgn.stale ? 'late' : 'ok';
  const lastRgnSync = data.rgn.events.map(e => e.syncedAt).filter(Boolean).sort().pop();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div style={muted}>
          Frissítve: {fmtFull(now)} · 30 másodpercenként magától frissül
          {data.version.commit && <> · Verzió: <Text code style={{ color: '#E0D6C8' }}>{data.version.commit}</Text>{data.version.env && ` (${data.version.env})`}</>}
        </div>
        <Button size="small" icon={<ReloadOutlined spin={refreshing} />} onClick={onRefresh}>Frissítés</Button>
      </div>
      {data.version.message && <div style={{ ...muted, marginTop: -8 }}>Utolsó módosítás: {data.version.message}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatusTile title="Weboldal" status={data.maintenance ? 'warn' : 'ok'} label={data.maintenance ? 'Karbantartás' : 'Elérhető'} detail={data.maintenance ? 'A nyilvános oldal zárva' : 'Nyilvánosan elérhető'} />
        <StatusTile title="Adatbázis" status={data.db.ok ? (data.db.latencyMs > 1500 ? 'warn' : 'ok') : 'error'} label={data.db.ok ? (data.db.latencyMs > 1500 ? 'Lassú' : 'Működik') : 'Nem elérhető'} detail={data.db.ok ? `${data.db.latencyMs} ms válaszidő` : data.db.error} />
        <StatusTile title="Időzített feladatok" status={jobStatus} label={jobStatus === 'ok' ? 'Rendben' : undefined} detail={data.jobs.map(j => `${j.label.split(' (')[0]}: ${ago(j.lastRun?.at, now)}`).join(' · ')} />
        <StatusTile title="Riftbound szinkron" status={rgnStatus} label={rgnStatus === 'info' ? 'Nincs esemény' : rgnStatus === 'late' ? 'Elavult' : undefined} detail={data.rgn.events.length ? `${data.rgn.events.length} esemény · utoljára ${ago(lastRgnSync, now)}${data.rgn.failed ? ` · ${data.rgn.failed} hibás` : ''}` : 'Nincs közelgő külső oldalas esemény'} />
        <StatusTile title="Szerverhibák (24 óra)" status={data.errors24h ? (data.errors24h > 10 ? 'error' : 'warn') : 'ok'} label={data.errors24h ? `${data.errors24h} hiba` : 'Nincs hiba'} detail={data.errors[0] ? `Utolsó: ${ago(data.errors[0].at, now)}` : 'Az elmúlt 30 napban sem'} />
        <StatusTile title="Beállítások" status={failingRequired.length ? 'error' : 'ok'} label={failingRequired.length ? `${failingRequired.length} hiányzik` : 'Rendben'} detail={data.integrations.find(i => i.key === 'mail')?.ok ? 'E-mail küldés beállítva' : 'E-mail küldés még nincs beállítva'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className={panel}>
          <h3 style={panelTitle}>Időzített feladatok</h3>
          <div className="space-y-3">
            {data.jobs.map(j => (
              <div key={j.job} className="bg-[#2a2022] rounded-lg border border-[#2a2022] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong style={{ color: '#E0D6C8' }}>{j.label}</strong>
                  <StatusBadge status={j.status} />
                </div>
                <div style={muted}>{j.description} · {j.schedule}</div>
                <div style={{ color: '#E0D6C8', fontSize: 13, marginTop: 4 }}>
                  Utolsó futás: {j.lastRun ? <>{fmt(j.lastRun.at)} ({ago(j.lastRun.at, now)}){j.lastRun.durationMs != null && `, ${duration(j.lastRun.durationMs)}`}</> : 'még nem rögzítettünk futást'}
                </div>
                {j.lastRun?.ok && runDetails(j.lastRun.details) && <div style={muted}>{runDetails(j.lastRun.details)}</div>}
                {j.lastRun && !j.lastRun.ok && <div style={{ color: '#e5534b', fontSize: 13 }}>Hiba: {j.lastRun.error}{j.lastSuccessAt && ` · utolsó sikeres: ${fmt(j.lastSuccessAt)}`}</div>}
                {j.status === 'late' && <div style={{ color: '#e0a030', fontSize: 13 }}>A tervezett időpontban nem futott le. Ellenőrizd a CRON_SECRET beállítást és a Vercel Cron Jobs oldalát.</div>}
                {j.history.length > 1 && (
                  <div className="flex flex-wrap gap-1 mt-2" aria-label="Korábbi futások">
                    {j.history.map((r, i) => (
                      <Tooltip key={i} title={<>{fmt(r.at)} · {r.ok ? 'sikeres' : `hiba: ${r.error}`}{r.durationMs != null && ` · ${duration(r.durationMs)}`}{r.ok && runDetails(r.details) ? <><br />{runDetails(r.details)}</> : null}</>}>
                        <span style={{ color: r.ok ? STATUS.ok.color : STATUS.error.color, fontSize: 14, cursor: 'default' }}>{r.ok ? <CheckCircleFilled /> : <CloseCircleFilled />}</span>
                      </Tooltip>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className={panel}>
          <h3 style={panelTitle}>Beállítások és kapcsolatok</h3>
          <div className="divide-y divide-[#3a2427]">
            {data.integrations.map(i => (
              <div key={i.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <div style={{ color: '#E0D6C8' }}>{i.label}</div>
                  <div style={muted}>{i.detail}</div>
                </div>
                <StatusBadge status={i.info ? 'info' : i.ok ? 'ok' : i.optional ? 'off' : 'error'} label={i.info ? i.state : i.ok ? 'Rendben' : i.optional ? 'Nincs beállítva' : 'Hiányzik'} />
              </div>
            ))}
          </div>
          <div style={{ ...muted, marginTop: 8 }}>A titkos kulcsok értéke soha nem jelenik meg, csak az, hogy be vannak-e állítva.</div>
        </div>
      </div>

      <div className={panel}>
        <h3 style={panelTitle}>Riftbound jelentkezők szinkronja</h3>
        {data.rgn.events.length ? (
          <Table size="small" dataSource={data.rgn.events} rowKey="id" pagination={false} scroll={{ x: 640 }} columns={[
            { title: 'Esemény', dataIndex: 'name', render: (n, e) => <span style={{ color: '#E0D6C8' }}>{n} <a href={e.url} target="_blank" rel="noopener noreferrer" style={{ color: '#E5B15D' }} aria-label="Megnyitás a Riftbound oldalon"><LinkOutlined /></a></span> },
            { title: 'Időpont', dataIndex: 'date', render: (d, e) => <span style={{ color: '#baaaac', whiteSpace: 'nowrap' }}>{eventDate(d)}{e.store ? ` · ${STORE_NAMES[e.store] || e.store}` : ''}</span> },
            { title: 'Jelentkezők', render: (_, e) => <span style={{ color: '#E0D6C8', whiteSpace: 'nowrap' }}>{e.active ?? '–'}{e.capacity ? ` / ${e.capacity}` : ''}{e.waitlist ? ` (+${e.waitlist} várólista)` : ''}</span> },
            { title: 'Utolsó lekérdezés', dataIndex: 'syncedAt', render: d => <span style={{ color: '#baaaac', whiteSpace: 'nowrap' }}>{d ? `${fmt(d)} (${ago(d, now)})` : 'még nem'}</span> },
            { title: 'Állapot', render: (_, e) => e.ok === null ? <StatusBadge status="unknown" label="Várakozik" /> : e.ok ? <StatusBadge status="ok" label="Sikeres" /> : <Tooltip title={e.error}><span><StatusBadge status="error" label="Sikertelen" /></span></Tooltip> },
          ]} />
        ) : <Empty description={<span style={muted}>Nincs közelgő esemény Riftbound linkkel</span>} />}
        <div style={{ ...muted, marginTop: 8 }}>Az admin felület megnyitásakor 5 percenként, a nyilvános naptárnál 15 percenként, éjjel pedig a napi feladattal frissül.</div>
      </div>

      <div className={panel}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 style={panelTitle}>Szerverhibák</h3>
          <span style={muted}>Az utolsó 50, 30 napig őrizzük</span>
        </div>
        {data.errors.length ? (
          <Table size="small" dataSource={data.errors} rowKey="id" pagination={{ pageSize: 8, showSizeChanger: false }} scroll={{ x: 640 }}
            expandable={{ expandedRowKeys: openError ? [openError] : [], onExpand: (open, r) => setOpenError(open ? r.id : null), expandedRowRender: r => <pre style={{ color: '#baaaac', fontSize: 12, whiteSpace: 'pre-wrap', margin: 0 }}>{r.stack || 'Nincs részlet'}</pre> }}
            columns={[
              { title: 'Időpont', dataIndex: 'at', render: d => <span style={{ color: '#baaaac', whiteSpace: 'nowrap' }}>{fmt(d)}</span> },
              { title: 'Hol', dataIndex: 'source', render: s => <Tag color="volcano">{s}</Tag> },
              { title: 'Hibaüzenet', dataIndex: 'message', render: m => <span style={{ color: '#E0D6C8' }}>{m}</span> },
            ]} />
        ) : <div className="flex items-center gap-2" style={{ color: STATUS.ok.color }}><CheckCircleFilled /> Nem volt szerverhiba az elmúlt 30 napban.</div>}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className={panel}>
          <h3 style={panelTitle}>Aktivitás</h3>
          <ActivityChart days={data.activity} />
          <div style={{ ...muted, marginTop: 8 }}>Az elmúlt 24 órában {data.logs24h} naplóbejegyzés.</div>
        </div>
        <div className={panel}>
          <h3 style={panelTitle}>Utolsó bejelentkezések</h3>
          {data.lastLogins.length ? (
            <div className="divide-y divide-[#3a2427]">
              {data.lastLogins.map(u => (
                <div key={u.username} className="flex items-center justify-between gap-2 py-1.5">
                  <span style={{ color: '#E0D6C8' }}>{u.username} {u.role === 'owner' && <Tag color="gold" style={{ marginLeft: 4 }}>tulajdonos</Tag>}</span>
                  <Tooltip title={fmtFull(u.at)}><span style={muted}>{ago(u.at, now)}</span></Tooltip>
                </div>
              ))}
            </div>
          ) : <span style={muted}>Még nincs rögzített bejelentkezés.</span>}
        </div>
        <div className={panel}>
          <h3 style={panelTitle}>Védelmi korlátok (24 óra)</h3>
          <div className="divide-y divide-[#3a2427]">
            {data.security.map(r => (
              <div key={r.prefix} className="flex items-center justify-between gap-2 py-1.5">
                <Tooltip title={`Korlát: ${r.limit}`}><span style={{ color: '#E0D6C8' }}>{r.label}</span></Tooltip>
                <span style={{ color: '#E0D6C8', fontWeight: 600 }}>{r.count}</span>
              </div>
            ))}
          </div>
          <div style={{ ...muted, marginTop: 8 }}>Ennyi kérést számoltak a visszaélés elleni korlátok. Hirtelen sok bejelentkezési próbálkozás támadásra utalhat.</div>
        </div>
      </div>

      <div className={panel}>
        <h3 style={panelTitle}>Számok</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <NumberTile label="Közelgő esemény" value={data.counts.upcomingEvents} />
          <NumberTile label="Jelentkezés közelgő eseményre" value={data.counts.upcomingRegistrations} />
          <NumberTile label="Nyitott előrendelés" value={data.counts.openProducts} hint={`${data.counts.products} termék, ${data.counts.preorders} rendelés`} />
          <NumberTile label="Liga" value={data.counts.leagues} />
          <NumberTile label="Szervező" value={data.counts.admins} />
          <NumberTile label="Felhasználó" value={data.counts.users} hint={data.counts.disabledUsers ? `${data.counts.disabledUsers} letiltva` : null} />
        </div>
      </div>
    </div>
  );
}

const PAGE = 50;

function LogView() {
  const [filters, setFilters] = useState({ q: '', action: null, admin: null, range: null });
  const [q, setQ] = useState('');
  const [data, setData] = useState({ items: [], total: 0, actions: [], admins: [] });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const params = useCallback((extra = {}) => {
    const p = new URLSearchParams();
    if (filters.q) p.set('q', filters.q);
    if (filters.action) p.set('action', filters.action);
    if (filters.admin) p.set('admin', filters.admin);
    if (filters.range?.[0]) p.set('from', filters.range[0].format('YYYY-MM-DD'));
    if (filters.range?.[1]) p.set('to', filters.range[1].format('YYYY-MM-DD'));
    Object.entries(extra).forEach(([k, v]) => p.set(k, String(v)));
    return p.toString();
  }, [filters]);

  // A „loading” állapotot a szűrő- és lapváltás kapcsolja be (nem az effect), a betöltés végén kikapcsol
  const load = useCallback(async (pageNo) => {
    try {
      const res = await fetch(`/api/admin-system/logs?${params({ limit: PAGE, skip: (pageNo - 1) * PAGE })}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
    } catch (err) {
      message.error(err.message || 'A napló betöltése nem sikerült.');
    }
    setLoading(false);
  }, [params]);

  // A napló külső rendszerből (API) töltődik a szűrők / oldal változásakor, ezért effektben fut
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(page); }, [load, page]);
  const setFilter = (key, value) => { setLoading(true); setPage(1); setFilters(f => ({ ...f, [key]: value })); };
  const changePage = (p) => { setLoading(true); setPage(p); };
  // Gépelés közben kis késleltetéssel keres
  const typingTimer = useRef(null);
  const onSearchChange = (value) => {
    setQ(value);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setFilter('q', value.trim()), 350);
  };
  useEffect(() => () => clearTimeout(typingTimer.current), []);
  const hasFilter = filters.q || filters.action || filters.admin || filters.range;

  return (
    <div className={panel}>
      <div className="flex flex-wrap gap-2 mb-3">
        <Input allowClear prefix={<SearchOutlined style={{ color: '#E5B15D' }} />} placeholder="Keresés a naplóban (név, művelet, részletek)..." value={q} onChange={e => onSearchChange(e.target.value)} style={{ flex: '1 1 260px' }} />
        <Select allowClear showSearch placeholder="Művelet" value={filters.action} onChange={v => setFilter('action', v ?? null)} options={data.actions.map(a => ({ value: a, label: a }))} style={{ flex: '1 1 180px', minWidth: 160 }} />
        <Select allowClear showSearch placeholder="Szervező" value={filters.admin} onChange={v => setFilter('admin', v ?? null)} options={data.admins.map(a => ({ value: a, label: a }))} style={{ flex: '1 1 150px', minWidth: 140 }} />
        <RangePicker value={filters.range} onChange={v => setFilter('range', v)} placeholder={['Ettől', 'Eddig']} style={{ flex: '1 1 240px' }} />
        {hasFilter && <Button onClick={() => { clearTimeout(typingTimer.current); setQ(''); setLoading(true); setPage(1); setFilters({ q: '', action: null, admin: null, range: null }); }}>Szűrők törlése</Button>}
        <Button icon={<DownloadOutlined />} href={`/api/admin-system/logs?${params({ format: 'xlsx' })}`}>Excel</Button>
      </div>
      <div style={{ ...muted, marginBottom: 8 }}>{data.total} bejegyzés{hasFilter ? ' a szűrésnek megfelelően' : ''}</div>
      <Table size="small" loading={loading} dataSource={data.items} rowKey="id" scroll={{ x: 720 }}
        pagination={{ current: page, pageSize: PAGE, total: data.total, showSizeChanger: false, onChange: changePage }}
        columns={[
          { title: 'Időpont', dataIndex: 'date', width: 150, render: d => <Tooltip title={fmtFull(d)}><span style={{ color: '#baaaac', whiteSpace: 'nowrap' }}>{fmt(d)}</span></Tooltip> },
          { title: 'Szervező', dataIndex: 'adminName', width: 130, render: n => <Tag color="purple" style={{ cursor: 'pointer' }} onClick={() => setFilter('admin', n)}>{n}</Tag> },
          { title: 'Művelet', dataIndex: 'action', width: 190, render: a => <button type="button" onClick={() => setFilter('action', a)} style={{ color: '#E5B15D', fontWeight: 700, background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }}>{a}</button> },
          { title: 'Részletek', dataIndex: 'details', render: t => <span style={{ color: '#E0D6C8' }}>{t}</span> },
        ]} />
    </div>
  );
}

export default function SystemDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('overview');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin-system', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
      setError(null);
    } catch (err) {
      setError(err.message || 'A rendszerállapot betöltése nem sikerült.');
    }
    setRefreshing(false);
  }, []);
  // Az első betöltés külső rendszerből (API) szinkronizál, ezért effektben fut
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);
  const manualRefresh = () => { setRefreshing(true); load(); };
  useLiveRefresh(load, 30000, tab === 'overview' && !!data);

  return (
    <ConfigProvider theme={adminTheme}>
      <Tabs activeKey={tab} onChange={setTab} items={[
        {
          key: 'overview', label: 'Áttekintés',
          children: data ? <Overview data={data} onRefresh={manualRefresh} refreshing={refreshing} />
            : <div className={panel} style={{ color: error ? '#e5534b' : '#E5B15D' }}>{error || 'Betöltés...'}</div>,
        },
        { key: 'logs', label: 'Napló', children: <LogView /> },
      ]} />
      {data && error && <div style={{ color: '#e5534b', fontSize: 13 }}>Az utolsó frissítés nem sikerült: {error}</div>}
    </ConfigProvider>
  );
}
