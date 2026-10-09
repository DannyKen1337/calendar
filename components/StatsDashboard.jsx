"use client";
import { useEffect, useMemo, useState } from 'react';
import { ConfigProvider, Select, Segmented, Table, Typography, Empty } from 'antd';
import { tavernTheme } from '@/app/components';
import { getGameColor } from '@/lib/gameConfig';

const { Title, Text } = Typography;

// Megjelent / nem jelent meg: sötét háttéren (#1a1012) validált színpár (CVD és normál látással is jól elkülönül)
const COLOR_ATTENDED = '#B8822F';
const COLOR_NO_SHOW = '#C2546B';

const MONTHS_SHORT = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];
const monthLabel = (key, withYear = false) => {
  const [y, m] = key.split('-').map(Number);
  return withYear ? `${y}. ${MONTHS_SHORT[m - 1]}` : MONTHS_SHORT[m - 1];
};
const monthKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const pct = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);

const PERIODS = [
  { value: 3, label: '3 hónap' },
  { value: 6, label: '6 hónap' },
  { value: 12, label: '12 hónap' },
];

const panel = 'bg-[#1a1012] p-4 rounded-xl border border-[#4A2E33]';
const panelTitle = { color: '#E5B15D', margin: '0 0 12px 0', fontFamily: 'Georgia, serif' };

const StatTile = ({ label, value, hint }) => (
  <div className="bg-[#2B1A1C] rounded-lg border border-[#4A2E33] px-4 py-3">
    <div style={{ color: '#E0D6C8', fontSize: 26, fontWeight: 'bold', lineHeight: 1.2 }}>{value}</div>
    <div style={{ color: '#baaaac', fontSize: 13 }}>{label}</div>
    {hint && <div style={{ color: '#7d6e70', fontSize: 12, marginTop: 2 }}>{hint}</div>}
  </div>
);

const Legend = () => (
  <div className="flex flex-wrap gap-4" style={{ fontSize: 13, color: '#baaaac' }}>
    <span className="flex items-center gap-2"><span style={{ width: 12, height: 12, borderRadius: 3, background: COLOR_ATTENDED, display: 'inline-block' }} />Megjelent</span>
    <span className="flex items-center gap-2"><span style={{ width: 12, height: 12, borderRadius: 3, background: COLOR_NO_SHOW, display: 'inline-block' }} />Nem jelent meg</span>
  </div>
);

// Havi oszlopdiagram: halmozott oszlop (megjelent alul, nem jelent meg felül), egy tengely, rámutatva részletek
const MonthlyChart = ({ months }) => {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...months.map(m => m.attended + m.noShow));
  const CHART_H = 180;
  const active = hover !== null ? months[hover] : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <Legend />
        <div style={{ fontSize: 13, color: '#baaaac', minHeight: 20 }}>
          {active
            ? <><b style={{ color: '#E0D6C8' }}>{monthLabel(active.key, true)}</b>: {active.attended} megjelent · {active.noShow} nem jelent meg · {active.events} esemény{active.attended + active.noShow > 0 ? ` · ${pct(active.attended, active.attended + active.noShow)}% megjelenés` : ''}</>
            : 'Vidd az egeret egy oszlop fölé a részletekért.'}
        </div>
      </div>
      <div className="flex items-end gap-1 sm:gap-2" style={{ height: CHART_H + 40, borderBottom: '1px solid #4A2E33' }} onMouseLeave={() => setHover(null)}>
        {months.map((m, i) => {
          const total = m.attended + m.noShow;
          const hA = (m.attended / max) * CHART_H;
          const hN = (m.noShow / max) * CHART_H;
          return (
            <div
              key={m.key}
              className="flex-1 flex flex-col items-center justify-end h-full cursor-default"
              style={{ minWidth: 0, opacity: hover === null || hover === i ? 1 : 0.55, transition: 'opacity 120ms' }}
              onMouseEnter={() => setHover(i)}
              onClick={() => setHover(i)}
              aria-label={`${monthLabel(m.key, true)}: ${m.attended} megjelent, ${m.noShow} nem jelent meg`}
            >
              <div style={{ color: '#baaaac', fontSize: 12, marginBottom: 4 }}>{total > 0 ? total : ''}</div>
              <div className="w-full flex flex-col items-center" style={{ maxWidth: 44 }}>
                {m.noShow > 0 && <div style={{ width: '100%', height: hN, background: COLOR_NO_SHOW, borderRadius: '4px 4px 0 0', marginBottom: m.attended > 0 ? 2 : 0 }} />}
                {m.attended > 0 && <div style={{ width: '100%', height: hA, background: COLOR_ATTENDED, borderRadius: m.noShow > 0 ? 0 : '4px 4px 0 0' }} />}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 sm:gap-2 mt-1">
        {months.map(m => (
          <div key={m.key} className="flex-1 text-center" style={{ minWidth: 0, color: '#9a8a8c', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden' }}>{monthLabel(m.key)}</div>
        ))}
      </div>
    </div>
  );
};

// Kis vízszintes sáv egy arányhoz (a táblázatokban)
const RateBar = ({ value, color }) => (
  <div className="flex items-center gap-2">
    <div style={{ flex: 1, minWidth: 60, height: 8, background: '#2B1A1C', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 4 }} />
    </div>
    <span style={{ color: '#E0D6C8', fontSize: 13, minWidth: 36, textAlign: 'right' }}>{value}%</span>
  </div>
);

export default function StatsDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState(12);
  const [games, setGames] = useState([]);
  const [monthlyView, setMonthlyView] = useState('chart');

  useEffect(() => {
    fetch(`/api/admin-stats?t=${Date.now()}`)
      .then(res => res.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(() => setError('Hálózati hiba a statisztika betöltésekor.'));
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    const now = new Date();
    const monthKeys = Array.from({ length: period }, (_, i) => monthKeyOf(new Date(now.getFullYear(), now.getMonth() - (period - 1 - i), 1)));
    const inPeriod = new Set(monthKeys);
    const rows = data.rows.filter(r => r.m && inPeriod.has(r.m) && (games.length === 0 || games.includes(r.c)));

    const attended = rows.filter(r => r.a).length;
    const noShow = rows.length - attended;
    const events = new Set(rows.map(r => r.e));
    const players = new Set(rows.map(r => r.p));

    const months = monthKeys.map(key => {
      const mr = rows.filter(r => r.m === key);
      const a = mr.filter(r => r.a).length;
      return { key, attended: a, noShow: mr.length - a, events: new Set(mr.map(r => r.e)).size };
    });

    const byGame = new Map();
    rows.forEach(r => {
      if (!byGame.has(r.c)) byGame.set(r.c, { game: r.c, attended: 0, noShow: 0, events: new Set(), players: new Set() });
      const g = byGame.get(r.c);
      if (r.a) g.attended++; else g.noShow++;
      g.events.add(r.e); g.players.add(r.p);
    });
    const gameRows = [...byGame.values()]
      .map(g => ({ game: g.game, attended: g.attended, noShow: g.noShow, events: g.events.size, players: g.players.size, rate: pct(g.attended, g.attended + g.noShow) }))
      .sort((a, b) => b.attended - a.attended);

    const byPlayer = new Map();
    rows.forEach(r => {
      if (!byPlayer.has(r.p)) byPlayer.set(r.p, { attended: 0, noShow: 0, games: new Set() });
      const p = byPlayer.get(r.p);
      if (r.a) p.attended++; else p.noShow++;
      p.games.add(r.c);
    });
    const topPlayers = [...byPlayer.entries()]
      .map(([idx, p]) => ({ key: idx, ...data.players[idx], attended: p.attended, noShow: p.noShow, games: [...p.games], rate: pct(p.attended, p.attended + p.noShow) }))
      .sort((a, b) => b.attended - a.attended || a.noShow - b.noShow)
      .slice(0, 20);

    return { attended, noShow, total: rows.length, events: events.size, players: players.size, months, gameRows, topPlayers };
  }, [data, period, games]);

  const gameOptions = useMemo(() => [...new Set((data?.rows || []).map(r => r.c))].sort().map(g => ({ value: g, label: g })), [data]);

  if (error) return <div className={panel}><Text style={{ color: '#ff7875' }}>{error}</Text></div>;
  if (!stats) return <div className={panel}><Text style={{ color: '#baaaac' }}>Statisztika betöltése...</Text></div>;

  const gameDot = (g) => <span style={{ width: 10, height: 10, borderRadius: '50%', background: getGameColor({ category: g }), display: 'inline-block', marginRight: 8 }} />;

  return (
    <ConfigProvider theme={tavernTheme}>
      <div className="flex flex-col gap-4">
        {/* Szűrők egy sorban a diagramok fölött */}
        <div className={`${panel} flex flex-wrap items-center gap-3`}>
          <Segmented options={PERIODS} value={period} onChange={setPeriod} />
          <Select mode="multiple" allowClear value={games} onChange={setGames} options={gameOptions} placeholder="Minden játék" maxTagCount="responsive" style={{ minWidth: 220, flex: 1 }} />
          <Text style={{ color: '#7d6e70', fontSize: 12 }}>A check-in adatokból (megjelent / nem jelent meg), legfeljebb 1 évre visszamenőleg.</Text>
        </div>

        {stats.total === 0 ? (
          <div className={panel}><Empty description={<span style={{ color: '#baaaac' }}>Ebben az időszakban még nincs check-in adat. A statisztika a „Jelentkezők” ablakban vagy a mobilos check-in nézetben rögzített jelölésekből készül.</span>} /></div>
        ) : (
          <>
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <StatTile label="Megjelenési arány" value={`${pct(stats.attended, stats.total)}%`} hint={`${stats.attended} megjelent / ${stats.total} jelölés`} />
              <StatTile label="Nem jelent meg" value={stats.noShow} hint={`${pct(stats.noShow, stats.total)}% a jelölésekből`} />
              <StatTile label="Különböző játékos" value={stats.players} />
              <StatTile label="Esemény check-in adattal" value={stats.events} />
            </div>

            <div className={panel}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <Title level={5} style={{ ...panelTitle, margin: 0 }}>Havi részvétel</Title>
                <Segmented size="small" value={monthlyView} onChange={setMonthlyView} options={[{ value: 'chart', label: 'Diagram' }, { value: 'table', label: 'Táblázat' }]} />
              </div>
              {monthlyView === 'chart' ? <MonthlyChart months={stats.months} /> : (
                <Table size="small" pagination={false} rowKey="key" dataSource={stats.months} columns={[
                  { title: 'Hónap', dataIndex: 'key', render: k => monthLabel(k, true) },
                  { title: 'Esemény', dataIndex: 'events', align: 'right' },
                  { title: 'Megjelent', dataIndex: 'attended', align: 'right' },
                  { title: 'Nem jelent meg', dataIndex: 'noShow', align: 'right' },
                  { title: 'Megjelenési arány', key: 'rate', align: 'right', render: (_, m) => (m.attended + m.noShow > 0 ? `${pct(m.attended, m.attended + m.noShow)}%` : '—') },
                ]} />
              )}
            </div>

            <div className="grid gap-4 xl:grid-cols-2 items-start">
              <div className={panel}>
                <Title level={5} style={panelTitle}>Játékonként</Title>
                <Table size="small" pagination={false} rowKey="game" dataSource={stats.gameRows} scroll={{ x: 520 }} columns={[
                  { title: 'Játék', dataIndex: 'game', render: g => <span style={{ color: '#E0D6C8' }}>{gameDot(g)}{g}</span> },
                  { title: 'Esemény', dataIndex: 'events', align: 'right' },
                  { title: 'Játékos', dataIndex: 'players', align: 'right' },
                  { title: 'Megjelent', dataIndex: 'attended', align: 'right' },
                  { title: 'Megjelenési arány', dataIndex: 'rate', width: 170, render: r => <RateBar value={r} color={COLOR_ATTENDED} /> },
                ]} />
              </div>

              <div className={panel}>
                <Title level={5} style={panelTitle}>Legaktívabb játékosok</Title>
                <Table size="small" pagination={false} rowKey="key" dataSource={stats.topPlayers} scroll={{ x: 520 }} columns={[
                  { title: '#', key: 'rank', width: 40, render: (_, __, i) => <span style={{ color: '#9a8a8c' }}>{i + 1}.</span> },
                  { title: 'Játékos', dataIndex: 'name', render: (n, p) => <div><div style={{ color: '#E0D6C8', fontWeight: 'bold' }}>{n}</div>{p.fullName && p.fullName !== n && <div style={{ color: '#9a8a8c', fontSize: 12 }}>{p.fullName}</div>}</div> },
                  { title: 'Játékok', dataIndex: 'games', render: gs => <span style={{ color: '#baaaac', fontSize: 12 }}>{gs.join(', ')}</span> },
                  { title: 'Megjelent', dataIndex: 'attended', align: 'right' },
                  { title: 'Kihagyta', dataIndex: 'noShow', align: 'right', render: n => <span style={{ color: n > 0 ? '#E0D6C8' : '#7d6e70' }}>{n}</span> },
                ]} />
              </div>
            </div>
          </>
        )}
      </div>
    </ConfigProvider>
  );
}
