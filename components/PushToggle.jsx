"use client";
import { useEffect, useState } from 'react';
import { Switch, message } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import s from './AdminApp.module.css';

// Telefonos értesítés új válaszról, ezen az eszközön (lib/push.js, public/admin-sw.js). Bekapcsoláskor engedélyt kér,
// feliratkozik, és a szerver küld egy „Bekapcsolva” értesítést. iPhone-on csak a kezdőképernyőre tett admin webappban
// működik: ha a Safariban nyitották meg, a kapcsoló helyett ezt mondja el.
const b64ToBytes = (b64) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
};
const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

async function registration() {
  const reg = await navigator.serviceWorker.register('/admin-sw.js', { scope: '/admin' });
  await navigator.serviceWorker.ready;
  return reg;
}

export default function PushToggle() {
  const [api, holder] = message.useMessage();
  // state: 'loading' | 'off' | 'on' | 'ios' (előbb a kezdőképernyőre) | 'unsupported' | 'denied'
  const [state, setState] = useState('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      if (!supported) return setState(isIos() && !isStandalone() ? 'ios' : 'unsupported');
      if (Notification.permission === 'denied') return setState('denied');
      try {
        const reg = await navigator.serviceWorker.getRegistration('/admin');
        const sub = reg && await reg.pushManager.getSubscription();
        if (!sub) return alive && setState('off');
        const res = await fetch(`/api/push?endpoint=${encodeURIComponent(sub.endpoint)}`).then(r => r.json());
        if (alive) setState(res.subscribed ? 'on' : 'off');
      } catch { if (alive) setState('off'); }
      return undefined;
    })();
    return () => { alive = false; };
  }, []);

  const turnOn = async () => {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { setState(perm === 'denied' ? 'denied' : 'off'); return; }
    const { publicKey } = await fetch('/api/push').then(r => r.json());
    const reg = await registration();
    const old = await reg.pushManager.getSubscription();
    if (old) await old.unsubscribe().catch(() => {});
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
    const res = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'SUBSCRIBE', payload: { subscription: sub.toJSON() } }) });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Nem sikerült bekapcsolni.');
    setState('on');
    api.success('Bekapcsolva. Pár másodpercen belül jön egy próba értesítés.');
  };
  const turnOff = async () => {
    const reg = await navigator.serviceWorker.getRegistration('/admin');
    const sub = reg && await reg.pushManager.getSubscription();
    if (sub) {
      await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'UNSUBSCRIBE', payload: { endpoint: sub.endpoint } }) });
      await sub.unsubscribe().catch(() => {});
    }
    setState('off');
  };
  const toggle = async (on) => {
    setBusy(true);
    try { await (on ? turnOn() : turnOff()); } catch (e) { api.error(e.message || 'Nem sikerült.'); } finally { setBusy(false); }
  };

  const hint = {
    loading: 'Új válasznál ezen az eszközön',
    off: 'Új válasznál ezen az eszközön',
    on: 'Bekapcsolva ezen az eszközön',
    ios: 'iPhone-on előbb tedd a kezdőképernyőre (Megosztás → Főképernyőhöz adás), és onnan nyisd meg az admint',
    unsupported: 'Ez a böngésző nem tud értesítést fogadni',
    denied: 'Az értesítések le vannak tiltva: a böngésző vagy a telefon beállításaiban engedélyezd ennek az oldalnak',
  }[state];
  const canSwitch = state === 'on' || state === 'off';

  return (
    <div className={s.tool} data-push={state}>
      {holder}
      <span className={s.toolIcon} aria-hidden="true"><BellOutlined /></span>
      <span className={s.toolText}><b id="push-cim">Értesítés új válaszról</b><small>{hint}</small></span>
      {canSwitch && <Switch checked={state === 'on'} loading={busy} onChange={toggle} aria-labelledby="push-cim" data-push-kapcsolo />}
    </div>
  );
}
