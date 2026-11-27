"use client";
import { useEffect, useState } from 'react';
import { Modal, Input, Button, Popconfirm, Alert, Tag } from 'antd';
import { CloseOutlined, SendOutlined } from '@ant-design/icons';
import { arrivalMail } from '@/lib/arrivalMail';

// Levél a szervezőknek (Továbbiak › Tulajdonos): az előre megírt szöveg (a szerverről, az aktuális admin címmel) átírható,
// élő előnézettel; kiküldéskor minden aktív szervező külön levelet kap a saját nevével ({név}), a tulajdonos aláírásával.
const label = { color: '#baaaac', fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 6 };

export default function StaffMailModal({ open, onClose, messageApi }) {
  const [data, setData] = useState(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    fetch('/api/staff-mail').then(r => r.json()).then(j => {
      if (!alive) return;
      setData(j);
      if (!j.error) { setSubject(j.subject); setBody(j.body); }
    }).catch(() => alive && setData({ error: 'Hálózati hiba.' }));
    return () => { alive = false; };
  }, [open]);

  const sample = data?.recipients?.[0]?.name || 'Szervező';
  const preview = arrivalMail({ subject, body }, { name: sample, quantity: '' });
  const send = async () => {
    setSending(true);
    try {
      const res = await fetch('/api/staff-mail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject, body }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) { messageApi?.error(json.error || 'A levél nem ment ki.'); return; }
      messageApi?.success(`Kiment ${json.sent} levél.`);
      if (json.failed?.length) messageApi?.warning(`${json.failed.length} levél nem ment ki: ${json.failed.join(', ')}`);
      onClose();
    } catch { messageApi?.error('Hálózati hiba.'); } finally { setSending(false); }
  };
  const n = data?.recipients?.length || 0;

  return (
    <Modal open={open} onCancel={onClose} width={760} closeIcon={<CloseOutlined style={{ color: '#E5B15D' }} />} destroyOnHidden
      title={<span style={{ fontWeight: 800, color: '#f3ece3' }}>Levél a szervezőknek</span>}
      footer={[
        <Button key="m" onClick={onClose}>Mégse</Button>,
        <Popconfirm key="k" title={`Kiküldöd ${n} szervezőnek?`} description="Mindenki külön levelet kap, a te aláírásoddal." okText="Kiküldés" cancelText="Mégse" onConfirm={send} disabled={!data?.canSend || !n || !subject.trim() || !body.trim()}>
          <Button type="primary" icon={<SendOutlined />} loading={sending} disabled={!data?.canSend || !n || !subject.trim() || !body.trim()} style={{ color: '#000', fontWeight: 'bold' }} data-korlevel-kuld>Kiküldés ({n} fő)</Button>
        </Popconfirm>,
      ]}>
      {!data ? <p style={{ color: '#9a8a8c' }}>Betöltés…</p> : data.error ? <Alert type="error" showIcon title={data.error} /> : (
        <div className="flex flex-col gap-4 mt-3" data-korlevel>
          {!data.canSend && <Alert type="warning" showIcon title="Az e-mail küldés nincs beállítva." />}
          <div>
            <span style={label}>Címzettek: {n} szervező</span>
            <div className="flex flex-wrap gap-1">{data.recipients.map(r => <Tag key={r.id} style={{ margin: 0 }}>{r.name}</Tag>)}{!n && <span style={{ color: '#9a8a8c' }}>Nincs másik szervező e-mail címmel.</span>}</div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              <div><label htmlFor="korlevel-targy" style={label}>Tárgy</label><Input id="korlevel-targy" value={subject} onChange={e => setSubject(e.target.value)} maxLength={200} /></div>
              <div>
                <label htmlFor="korlevel-szoveg" style={label}>Szöveg</label>
                <Input.TextArea id="korlevel-szoveg" value={body} onChange={e => setBody(e.target.value)} maxLength={5000} autoSize={{ minRows: 10, maxRows: 22 }} />
                <div style={{ color: '#9a8a8c', fontSize: 12, marginTop: 6 }}>A <b style={{ color: '#E0D6C8' }}>{'{név}'}</b> helyére a szervező neve kerül. A feladó: „{data.signer} – Tavern”, a válaszok hozzád jönnek.</div>
              </div>
            </div>
            <div>
              <span style={label}>Előnézet: így kapja meg {sample}</span>
              <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #2a2022' }}>
                <div style={{ padding: '8px 12px', background: '#211a1b', color: '#E0D6C8', fontSize: 13 }}><span style={{ color: '#9a8a8c' }}>Tárgy: </span><b>{preview.subject}</b></div>
                {/* a HTML-t a lib/arrivalMail.js készíti: minden beírt szöveg escape-elve */}
                <div dangerouslySetInnerHTML={{ __html: preview.html }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
