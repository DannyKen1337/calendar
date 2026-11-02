"use client";
import { useEffect, useRef, useState } from 'react';
import { PlusOutlined, SyncOutlined } from '@ant-design/icons';
import s from './PhoneApp.module.css';

// Az admin telefonos, app szerű elemei (960 px alatt látszanak): lebegő gomb, lehúzásos frissítés.

const PULL_MAX = 110;
const PULL_TRIGGER = 70;

export function Fab({ label, onClick }) {
  return <button type="button" className={s.fab} onClick={onClick} aria-label={label}><PlusOutlined /></button>;
}

// A lap tetején lefelé húzva frissít (a főképernyőről indított appban nincs böngészős frissítés gomb)
export function PullToRefresh({ onRefresh }) {
  const [distance, setDistance] = useState(0);
  const [busy, setBusy] = useState(false);
  const handler = useRef(onRefresh);
  useEffect(() => { handler.current = onRefresh; });

  useEffect(() => {
    let pulling = false;
    let startX = 0;
    let startY = 0;
    let current = 0;
    const onStart = (e) => {
      if (e.touches.length !== 1 || window.scrollY > 0 || e.target.closest?.('.ant-modal-root, .ant-drawer, input, textarea')) return;
      pulling = true;
      current = 0;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    const onMove = (e) => {
      if (!pulling) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      // Felfelé görgetés vagy vízszintes húzás (pl. a boltválasztó sor) nem frissítés
      if (current === 0 && (dy < 0 || Math.abs(dx) > dy)) {
        if (Math.abs(dx) > 8 || dy < -8) pulling = false;
        return;
      }
      current = Math.min(PULL_MAX, Math.max(0, dy * 0.5));
      setDistance(current);
    };
    const onEnd = async () => {
      if (!pulling) return;
      pulling = false;
      const trigger = current >= PULL_TRIGGER;
      current = 0;
      setDistance(0);
      if (!trigger) return;
      setBusy(true);
      try { await handler.current(); } finally { setBusy(false); }
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  if (!distance && !busy) return null;
  const offset = busy ? PULL_TRIGGER : distance;
  return (
    <div className={s.pull} style={{ transform: `translate(-50%, ${offset}px)`, opacity: busy ? 1 : Math.min(1, distance / PULL_TRIGGER) }} role="status" aria-label={busy ? 'Frissítés…' : 'Húzd tovább a frissítéshez'}>
      <SyncOutlined spin={busy} style={busy ? undefined : { transform: `rotate(${distance * 4}deg)` }} />
    </div>
  );
}
