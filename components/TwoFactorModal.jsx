"use client";
// Kétlépcsős azonosítás beállítása a saját fiókhoz (Továbbiak › Fiók). Egyszerű lépések, mert a felhasználók nem
// értenek hozzá: 1. app telepítése, 2. QR-kód beolvasása (vagy a kulcs beírása), 3. a kód beírása, 4. tartalék kódok.
// Kikapcsolás: jelszó + kód. Az ablak portálban nyílik: fix színek (a .shell CSS-változói itt nem érvényesek).
import { useEffect, useState } from 'react';
import { Modal, Input, Button, Alert, message } from 'antd';
import { SafetyOutlined, CopyOutlined, DownloadOutlined } from '@ant-design/icons';

const C = { text: '#E0D6C8', soft: '#baaaac', gold: '#E5B15D', box: '#1f1517', line: '#3a2a2d' };
const post = async (body) => {
  const res = await fetch('/api/auth/2fa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return res.ok ? data : { error: data.error || 'Hiba történt.' };
};
const codeInputProps = { inputMode: 'numeric', autoComplete: 'one-time-code', maxLength: 6, placeholder: '123456', size: 'large', style: { letterSpacing: 6, fontSize: 22, textAlign: 'center', maxWidth: 220 } };

function RecoveryCodes({ codes, onDone }) {
  const text = `Tavern Admin – tartalék kódok (mindegyik egyszer használható)\n\n${codes.join('\n')}\n`;
  const copy = async () => { try { await navigator.clipboard.writeText(text); message.success('Kimásolva.'); } catch { message.error('Nem sikerült kimásolni.'); } };
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = 'tavern-tartalek-kodok.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div data-tartalek-kodok>
      <p style={{ color: C.text }}>Ha elveszíted a telefonodat, ezekkel tudsz belépni (mindegyik egyszer jó). <b>Mentsd el vagy írd fel, és tartsd biztonságos helyen.</b> Később nem látod őket újra.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, background: C.box, border: `1px solid ${C.line}`, borderRadius: 10, padding: 14, fontFamily: 'ui-monospace, monospace', fontSize: 17, color: C.gold }}>
        {codes.map(c => <span key={c}>{c}</span>)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        <Button icon={<CopyOutlined />} onClick={copy}>Másolás</Button>
        <Button icon={<DownloadOutlined />} onClick={download}>Letöltés</Button>
        <Button type="primary" onClick={onDone} style={{ marginLeft: 'auto', color: '#000', fontWeight: 700 }} data-kesz>Elmentettem</Button>
      </div>
    </div>
  );
}

export default function TwoFactorModal({ onClose }) {
  const [status, setStatus] = useState(null);
  const [step, setStep] = useState('status'); // status | setup | codes | disable | newcodes
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [codes, setCodes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // az ablak minden megnyitáskor újonnan kerül a felületre (AdminApp), így tiszta állapottal indul
  const load = () => fetch('/api/auth/2fa').then(r => r.json()).then(setStatus).catch(() => setStatus(null));
  useEffect(() => { load(); }, []);

  const run = async (body, after) => {
    setBusy(true); setError('');
    const data = await post(body);
    setBusy(false);
    if (data.error) { setError(data.error); return; }
    after(data);
  };
  const start = () => run({ action: 'start' }, (d) => { setSetup(d); setCode(''); setStep('setup'); });
  const confirm = () => run({ action: 'confirm', code }, (d) => { setCodes(d.recoveryCodes); setStep('codes'); load(); });
  const disable = () => run({ action: 'disable', password, code }, () => { message.success('Kétlépcsős azonosítás kikapcsolva.'); load(); setStep('status'); setCode(''); setPassword(''); });
  const newCodes = () => run({ action: 'recovery', code }, (d) => { setCodes(d.recoveryCodes); setStep('codes'); load(); });

  const body = () => {
    if (!status) return <p style={{ color: C.soft }}>Betöltés…</p>;
    if (step === 'codes' && codes) return <RecoveryCodes codes={codes} onDone={() => { setStep('status'); setCodes(null); }} />;
    if (step === 'setup' && setup) return (
      <div style={{ color: C.text }} data-ketlepcsos-beallitas>
        <ol style={{ paddingLeft: 18, lineHeight: 1.6 }}>
          <li>Telepíts a telefonodra egy hitelesítő alkalmazást: <b>Google Authenticator</b> vagy <b>Microsoft Authenticator</b> (ingyenes).</li>
          <li>Az alkalmazásban nyomj a <b>+</b> gombra, és olvasd be ezt a QR-kódot:</li>
        </ol>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 12px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qr} alt="QR-kód a hitelesítő alkalmazáshoz" width={200} height={200} style={{ background: '#fff', borderRadius: 10, padding: 6 }} data-qr />
        </div>
        <details style={{ marginBottom: 12 }}>
          <summary style={{ color: C.soft, cursor: 'pointer' }}>Nem tudod beolvasni? Írd be a kulcsot kézzel</summary>
          <code style={{ display: 'block', marginTop: 6, color: C.gold, fontSize: 15, wordBreak: 'break-all' }} data-kulcs>{setup.secret}</code>
        </details>
        <p style={{ marginBottom: 8 }}>3. Írd be az alkalmazásban látható 6 jegyű kódot:</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Input {...codeInputProps} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} onPressEnter={confirm} autoFocus data-kod />
          <Button type="primary" size="large" loading={busy} disabled={code.length !== 6} onClick={confirm} style={{ color: '#000', fontWeight: 700 }} data-bekapcsolas>Bekapcsolás</Button>
        </div>
      </div>
    );
    if (step === 'disable' || step === 'newcodes') return (
      <div style={{ color: C.text, display: 'grid', gap: 10 }}>
        <p style={{ margin: 0 }}>{step === 'disable' ? 'A kikapcsoláshoz add meg a jelszavadat és egy kódot az alkalmazásból (vagy egy tartalék kódot).' : 'Új tartalék kódokhoz írj be egy kódot az alkalmazásból. A régi tartalék kódok érvényüket vesztik.'}</p>
        {step === 'disable' && <Input.Password size="large" placeholder="Jelszó" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />}
        <Input size="large" placeholder="Kód (6 számjegy vagy tartalék kód)" value={code} onChange={e => setCode(e.target.value)} autoComplete="one-time-code" onPressEnter={step === 'disable' ? disable : newCodes} />
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={() => { setStep('status'); setError(''); }}>Mégse</Button>
          <Button type="primary" danger={step === 'disable'} loading={busy} disabled={!code || (step === 'disable' && !password)} onClick={step === 'disable' ? disable : newCodes} style={step === 'disable' ? undefined : { color: '#000', fontWeight: 700 }}>
            {step === 'disable' ? 'Kikapcsolás' : 'Új tartalék kódok'}
          </Button>
        </div>
      </div>
    );
    return status.enabled ? (
      <div style={{ color: C.text, display: 'grid', gap: 10 }}>
        <Alert type="success" showIcon message="Be van kapcsolva" description={`Belépéskor a jelszó után az alkalmazás kódját is kérjük. Tartalék kódok: ${status.recoveryLeft} db maradt.`} />
        {status.recoveryLeft <= 3 && <Alert type="warning" showIcon message="Kevés tartalék kód maradt: kérj újakat." />}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button onClick={() => { setStep('newcodes'); setCode(''); }}>Új tartalék kódok</Button>
          <Button danger onClick={() => { setStep('disable'); setCode(''); setPassword(''); }}>Kikapcsolás</Button>
        </div>
      </div>
    ) : (
      <div style={{ color: C.text }}>
        <p>A jelszó mellett a telefonodon lévő alkalmazás 6 jegyű kódja is kell majd a belépéshez. Így ha valaki megtudja a jelszavadat, akkor sem tud belépni a nevedben.</p>
        {status.recommended && <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="A te fiókodnál erősen ajánlott" description="Személyes adatokhoz vagy a rendszer kezeléséhez is hozzáférsz." />}
        <Button type="primary" size="large" icon={<SafetyOutlined />} loading={busy} onClick={start} style={{ color: '#000', fontWeight: 700 }} data-ketlepcsos-inditas>Bekapcsolás</Button>
      </div>
    );
  };

  return (
    <Modal open onCancel={onClose} footer={null} destroyOnHidden title={<span style={{ color: C.gold }}>Kétlépcsős belépés</span>} width={480}>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} data-hiba />}
      {body()}
    </Modal>
  );
}
