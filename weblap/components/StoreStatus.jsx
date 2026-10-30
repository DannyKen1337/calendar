"use client";
import { useEffect, useState } from 'react';
import { storeById, storeStatus } from '@/weblap/lib/stores';

// Egy bolt "nyitva / zárva" állapota: a szerver kiszámolja (JavaScript nélkül is látszik), a böngésző percenként frissíti.
export default function StoreStatus({ storeId, initial, className = '', dotOpen = '#8fd3a5', dotClosed = '#8a8079' }) {
  const [status, setStatus] = useState(initial);
  useEffect(() => {
    const store = storeById(storeId);
    const tick = () => setStatus(storeStatus(store));
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 60 * 1000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [storeId]);
  if (!status) return <span className={className}>Nyitvatartás hamarosan</span>;
  return (
    <span className={className} aria-live="polite" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: status.open ? dotOpen : dotClosed, flex: 'none' }} />
      {status.text}
    </span>
  );
}
