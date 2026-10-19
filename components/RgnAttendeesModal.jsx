"use client";
import { Modal, Button, Table, Tag, Tabs, Typography, Empty } from 'antd';
import { CloseOutlined, SyncOutlined, LinkOutlined } from '@ant-design/icons';

const { Text } = Typography;

const fmt = (d) => (d ? new Date(d).toLocaleString('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const HISTORY_LABELS = {
  joined: { text: 'jelentkezett', color: 'green' },
  rejoined: { text: 'újra jelentkezett', color: 'green' },
  waitlisted: { text: 'várólistára került', color: 'gold' },
  promoted: { text: 'előlépett a várólistáról', color: 'blue' },
  left: { text: 'lejelentkezett', color: 'red' },
};

// A Riftbound oldalon (RGN) kezelt esemény jelentkezői: a naptár a nyilvános RGN oldalról olvassa ki őket,
// és rögzíti, ki mikor jelentkezett vagy jelentkezett le. Csak olvasható; a jelentkezés az RGN oldalon történik.
export default function RgnAttendeesModal({ event, data, open, onClose, onSync, syncing }) {
  if (!event) return null;
  const eId = String(event._id || event.id);
  const regs = (data?.registrations || []).filter(r => r.tournamentId === eId);
  const history = (data?.history || []).filter(h => h.tournamentId === eId);
  const active = regs.filter(r => !r.droppedAt && !r.waitlist);
  const waitlist = regs.filter(r => !r.droppedAt && r.waitlist).sort((a, b) => (a.waitlistPosition ?? 999) - (b.waitlistPosition ?? 999));
  const dropped = regs.filter(r => r.droppedAt).sort((a, b) => new Date(b.droppedAt) - new Date(a.droppedAt));
  const rgn = event.rgn || {};

  const nameCol = { title: 'Riot-azonosító', dataIndex: 'name', render: (t) => <span style={{ color: '#E5B15D', fontWeight: 'bold', overflowWrap: 'anywhere' }}>{t}</span> };
  const activeColumns = [
    { title: '#', key: 'n', width: 46, render: (_, __, i) => <span style={{ color: '#9a8a8c' }}>{i + 1}.</span> },
    nameCol,
    { title: 'Jelentkezett', dataIndex: 'registeredAt', render: (d, r) => <span style={{ color: '#baaaac', whiteSpace: 'nowrap' }}>{fmt(d || r.firstSeenAt)}</span> },
    { title: '', key: 'state', render: (_, r) => (r.waitlist ? <Tag color="gold" style={{ margin: 0 }}>Várólista{r.waitlistPosition ? ` #${r.waitlistPosition}` : ''}</Tag> : r.checkedIn ? <Tag color="green" style={{ margin: 0 }}>Check-in</Tag> : null) },
  ];
  const droppedColumns = [
    nameCol,
    { title: 'Jelentkezett', dataIndex: 'registeredAt', render: (d, r) => <span style={{ color: '#baaaac', whiteSpace: 'nowrap' }}>{fmt(d || r.firstSeenAt)}</span> },
    { title: 'Lejelentkezett', dataIndex: 'droppedAt', render: (d) => <span style={{ color: '#ff9b9b', whiteSpace: 'nowrap' }}>{fmt(d)}</span> },
  ];
  const empty = (text) => ({ emptyText: <span style={{ color: '#6b7280' }}>{text}</span> });

  return (
    <Modal
      title={<span style={{ fontFamily: 'Georgia, serif' }}>Riftbound jelentkezők: {event.name}</span>}
      open={open}
      onCancel={onClose}
      footer={null}
      width={760}
      closeIcon={<CloseOutlined style={{ color: '#E5B15D' }} />}
    >
      <div className="flex flex-col gap-3 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Text style={{ color: '#baaaac' }}>
            Jelentkezett: <b style={{ color: '#E0D6C8' }}>{active.length}{rgn.capacity ? ` / ${rgn.capacity}` : ''}</b>
            {waitlist.length > 0 && <> · Várólista: <b style={{ color: '#E0D6C8' }}>{waitlist.length}</b></>}
            {dropped.length > 0 && <> · Lejelentkezett: <b style={{ color: '#E0D6C8' }}>{dropped.length}</b></>}
          </Text>
          <span className="flex flex-wrap gap-2">
            <Button size="small" icon={<SyncOutlined spin={syncing} />} onClick={onSync} loading={false} disabled={syncing}>Frissítés most</Button>
            <Button size="small" icon={<LinkOutlined />} onClick={() => window.open(event.external_url, '_blank', 'noopener')}>Riftbound oldal</Button>
          </span>
        </div>
        <Text style={{ color: rgn.ok === false ? '#ff9b9b' : '#7d6e70', fontSize: 12 }}>
          {rgn.syncedAt
            ? `Utolsó lekérdezés: ${fmt(rgn.syncedAt)}${rgn.ok === false ? ` – sikertelen: ${rgn.error || 'ismeretlen hiba'}` : ''}. A lista magától frissül (legfeljebb 5 percenként), a jelentkezés és a lejelentkezés a Riftbound oldalon történik.`
            : 'Még nem volt lekérdezés. A „Frissítés most” gombbal azonnal betöltheted.'}
        </Text>

        <Tabs
          size="small"
          items={[
            { key: 'active', label: `Jelentkezők (${active.length + waitlist.length})`, children: <Table size="small" rowKey="id" dataSource={[...active, ...waitlist]} columns={activeColumns} pagination={false} scroll={{ x: 520 }} locale={empty('Még nincs jelentkező.')} /> },
            { key: 'dropped', label: `Lejelentkezettek (${dropped.length})`, children: <Table size="small" rowKey="id" dataSource={dropped} columns={droppedColumns} pagination={false} scroll={{ x: 520 }} locale={empty('Senki nem jelentkezett le.')} /> },
            {
              key: 'history', label: 'Előzmények', children: history.length === 0
                ? <Empty description={<span style={{ color: '#6b7280' }}>Még nincs rögzített változás.</span>} />
                : (
                  <ul className="list-none m-0 p-0 flex flex-col gap-1" style={{ maxHeight: 360, overflowY: 'auto' }}>
                    {history.map(h => {
                      const l = HISTORY_LABELS[h.type] || { text: h.type, color: 'default' };
                      return (
                        <li key={h.id} className="flex flex-wrap items-center gap-2 py-1 border-b border-[#4A2E33]">
                          <span style={{ color: '#9a8a8c', fontSize: 12, minWidth: 110 }}>{fmt(h.at)}</span>
                          <span style={{ color: '#E0D6C8', fontWeight: 'bold' }}>{h.name}</span>
                          <Tag color={l.color} style={{ margin: 0 }}>{l.text}</Tag>
                        </li>
                      );
                    })}
                  </ul>
                ),
            },
          ]}
        />
      </div>
    </Modal>
  );
}
