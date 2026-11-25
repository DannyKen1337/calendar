"use client";
import { useRef, useState } from 'react';
import { Modal, Input, Button, Alert, message } from 'antd';
import { CloseOutlined, SendOutlined } from '@ant-design/icons';
import Link from 'next/link';

// Üzenet egy jelentkezőnek / előrendelőnek a rendszeren keresztül: a szervező nem látja (és nem is kapja meg) a címzett
// e-mail címét, a válasz az Üzenetek között jelenik meg (/admin/uzenetek), csak neki és a tulajdonosnak.
// target: { kind: 'registration' | 'preorder', refId, name, context } | null; status: { send, replies }
export default function MessageModal({ target, status, onClose, onSent }) {
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const textRef = useRef(null);
  const [error, setError] = useState('');
  const [api, holder] = message.useMessage();

  const close = () => { setSubject(''); setText(''); setError(''); onClose(); };
  const send = async () => {
    if (!text.trim()) { setError('Írd be az üzenetet.'); return; }
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'SEND', payload: { kind: target.kind, refId: target.refId, subject: subject.trim() || `Tavern: ${target.context}`, text } }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Nem sikerült elküldeni.'); return; }
      if (data.status === 'sent') api.success('Elküldve. A válasz az Üzenetek között jelenik meg.');
      else if (data.status === 'saved') api.info('Elmentve az Üzenetek közé. (Teszt: az e-mail küldés még nincs beállítva, ezért levél nem ment ki.)');
      else api.warning('Elmentve, de az e-mail most nem ment ki. Próbáld újra később az Üzenetek között.');
      onSent?.(data);
      close();
    } catch {
      setError('Hálózati hiba. Próbáld újra.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {holder}
      <Modal
        open={!!target}
        onCancel={close}
        title={<span style={{ fontFamily: 'Georgia, serif' }}>Üzenet: {target?.name}</span>}
        closeIcon={<CloseOutlined style={{ color: '#E5B15D' }} />}
        footer={[
          <Button key="c" onClick={close}>Mégse</Button>,
          <Button key="s" type="primary" icon={<SendOutlined />} loading={busy} onClick={send} data-uzenet-kuld>Küldés</Button>,
        ]}
        destroyOnHidden
        // a megnyitás után a kurzor az üzenet mezőbe kerül (az ablak saját fókusza ne vigye el a gépelést)
        afterOpenChange={(o) => { if (o) textRef.current?.focus(); }}
      >
        <div data-uzenet-ablak>
          <p style={{ color: '#baaaac', marginTop: 0 }}>{target?.context}. Az e-mail címét nem látod: a levelet a rendszer küldi el, a választ az <Link href="/admin/uzenetek" style={{ color: '#E5B15D' }}>Üzenetek</Link> között látod (csak te és a tulajdonos).</p>
          {!status?.send && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title="Teszt mód" description="Az e-mail küldés még nincs beállítva: az üzenet csak a rendszerben mentődik el, levél nem megy ki." />}
          {status?.send && !status?.replies && <Alert type="info" showIcon style={{ marginBottom: 12 }} title="A levél kimegy, de a válasz még nem ide érkezik, hanem a rendszer postafiókjába." />}
          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ display: 'block', color: '#E0D6C8', marginBottom: 4 }}>Tárgy</span>
            <Input value={subject} onChange={e => setSubject(e.target.value)} maxLength={120} placeholder={target ? `Tavern: ${target.context}` : ''} />
          </label>
          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', color: '#E0D6C8', marginBottom: 4 }}>Üzenet</span>
            <Input.TextArea ref={textRef} value={text} onChange={e => { setText(e.target.value); if (error) setError(''); }} rows={6} maxLength={4000} showCount status={error ? 'error' : ''} aria-invalid={!!error} placeholder="Szia! …" />
          </label>
          {error && <div role="alert" style={{ color: '#ff7875', marginTop: 8 }}>{error}</div>}
        </div>
      </Modal>
    </>
  );
}
