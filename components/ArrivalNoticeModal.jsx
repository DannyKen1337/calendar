"use client";
import { useState } from 'react';
import { Modal, Input, Checkbox, Button, Popconfirm, Alert, Tag } from 'antd';
import { CloseOutlined, SendOutlined, UndoOutlined } from '@ant-design/icons';
import { storesText } from '@/lib/preorders';
import { arrivalMail, arrivalRecipients, defaultArrivalSubject, defaultArrivalBody, ARRIVAL_SUBJECT_MAX, ARRIVAL_BODY_MAX } from '@/lib/arrivalMail';

// „Megérkezett” értesítő egy termék előrendelőinek: előre megírt, szerkeszthető levél élő előnézettel (pontosan az, ami
// kimegy: ugyanaz a lib/arrivalMail.js készíti), utána megerősítéssel kiküldés. A szülő akkor rendereli, ha nyitva van,
// így minden megnyitáskor az alapszöveggel indul.
// product: { id, name, arrivalNotice }; orders: a termék jelentkezői; canSend: van e-mail beállítás; post: (actionType, payload) => json | null
const label = { color: '#baaaac', fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 6 };

export default function ArrivalNoticeModal({ product, orders, canSend, post, onClose, onSent }) {
  const [subject, setSubject] = useState(() => defaultArrivalSubject(product.name));
  const [body, setBody] = useState(() => defaultArrivalBody(product.name, storesText(product)));
  const [skipHanded, setSkipHanded] = useState(true);
  const [skipNotified, setSkipNotified] = useState(true);
  const [sending, setSending] = useState(false);

  const handedCount = orders.filter(o => o.handedOverAt).length;
  const notifiedCount = orders.filter(o => o.arrivalMailAt).length;
  const recipients = arrivalRecipients(orders, { skipHanded, skipNotified });
  const sample = recipients[0] || orders[0] || { name: 'Minta Vásárló', quantity: 1 };
  const preview = arrivalMail({ subject, body }, { name: sample.name, quantity: sample.quantity });
  const empty = !subject.trim() || !body.trim();

  const send = async () => {
    setSending(true);
    const res = await post('SEND_ARRIVAL_NOTICE', { productId: product.id, subject, body, skipHanded, skipNotified });
    setSending(false);
    if (res) onSent(res);
  };

  return (
    <Modal
      open
      width={760}
      title={<span style={{ fontWeight: 800, color: '#f3ece3' }}>Megérkezett: értesítő a feliratkozóknak</span>}
      onCancel={onClose}
      closeIcon={<CloseOutlined style={{ color: '#E5B15D' }} />}
      footer={[
        <Button key="megse" onClick={onClose}>Mégse</Button>,
        <Popconfirm key="kuld" title={`Kiküldöd ${recipients.length} embernek?`} description="Mindenki külön levelet kap, a címeket egymás nem látják." okText="Kiküldés" cancelText="Mégse" onConfirm={send} disabled={!canSend || empty || !recipients.length}>
          <Button type="primary" icon={<SendOutlined />} loading={sending} disabled={!canSend || empty || !recipients.length} style={{ color: '#000', fontWeight: 'bold' }} data-ertesites-kuld>
            Kiküldés ({recipients.length} fő)
          </Button>
        </Popconfirm>,
      ]}
    >
      <div className="flex flex-col gap-4 mt-3" data-ertesites>
        {!canSend && <Alert type="warning" showIcon message="Az e-mail küldés nincs beállítva, ezért a levél most nem küldhető ki." />}
        {product.arrivalNotice && (
          <Alert type="info" showIcon message={`Erről a termékről már ment ki értesítő (${new Date(product.arrivalNotice.at).toLocaleString('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}, ${product.arrivalNotice.by}).`} />
        )}

        <div>
          <span style={label}>Címzettek: {recipients.length} fő</span>
          <div className="flex flex-wrap gap-1" data-ertesites-cimzettek>
            {recipients.slice(0, 30).map(o => <Tag key={o.id} style={{ margin: 0 }}>{o.name}{o.quantity > 1 ? ` (${o.quantity} db)` : ''}</Tag>)}
            {recipients.length > 30 && <Tag style={{ margin: 0 }}>+{recipients.length - 30} további</Tag>}
            {!recipients.length && <span style={{ color: '#9a8a8c' }}>Nincs kinek kiküldeni.</span>}
          </div>
          <div className="flex flex-col gap-1 mt-2">
            {handedCount > 0 && <Checkbox checked={skipHanded} onChange={e => setSkipHanded(e.target.checked)} style={{ color: '#E0D6C8' }}>Akiknek már átadtad, ne kapják meg ({handedCount} fő)</Checkbox>}
            {notifiedCount > 0 && <Checkbox checked={skipNotified} onChange={e => setSkipNotified(e.target.checked)} style={{ color: '#E0D6C8' }} data-ertesites-ujra>Akik már kaptak értesítőt, ne kapják meg újra ({notifiedCount} fő)</Checkbox>}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <div>
              <label htmlFor="ertesites-targy" style={label}>Tárgy</label>
              <Input id="ertesites-targy" value={subject} onChange={e => setSubject(e.target.value)} maxLength={ARRIVAL_SUBJECT_MAX} status={subject.trim() ? undefined : 'error'} />
            </div>
            <div>
              <label htmlFor="ertesites-szoveg" style={label}>Szöveg</label>
              <Input.TextArea id="ertesites-szoveg" value={body} onChange={e => setBody(e.target.value)} maxLength={ARRIVAL_BODY_MAX} autoSize={{ minRows: 9, maxRows: 18 }} status={body.trim() ? undefined : 'error'} />
              <div style={{ color: '#9a8a8c', fontSize: 12, marginTop: 6 }}>A <b style={{ color: '#E0D6C8' }}>{'{név}'}</b> helyére a vásárló neve, a <b style={{ color: '#E0D6C8' }}>{'{darab}'}</b> helyére az előrendelt darabszám kerül. Üres sor: új bekezdés.</div>
            </div>
            <Button size="small" type="text" icon={<UndoOutlined />} onClick={() => { setSubject(defaultArrivalSubject(product.name)); setBody(defaultArrivalBody(product.name, storesText(product))); }} style={{ color: '#9a8a8c', alignSelf: 'flex-start' }}>Alapszöveg visszaállítása</Button>
          </div>
          <div>
            <span style={label}>Előnézet: így kapja meg {sample.name}</span>
            <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #2a2022' }}>
              <div style={{ padding: '8px 12px', background: '#211a1b', color: '#E0D6C8', fontSize: 13 }}><span style={{ color: '#9a8a8c' }}>Tárgy: </span><b data-ertesites-elonezet-targy>{preview.subject}</b></div>
              {/* A HTML-t a lib/arrivalMail.js készíti: minden beírt szöveg escape-elve */}
              <div data-ertesites-elonezet dangerouslySetInnerHTML={{ __html: preview.html }} />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
