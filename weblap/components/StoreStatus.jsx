"use client";
import { useEffect, useState } from 'react';
import { storeStatus } from '@/weblap/lib/stores';

// Egy bolt "nyitva / zárva" állapota: a szerver kiszámolja (JavaScript nélkül is látszik), a böngésző percenként frissíti.
// hours: a bolt nyitvatartása a tartalomból ({ 0: ['11:00', '20:00'], 1: null, ... })
export default function StoreStatus({ hours, initial, className = '', dotOpen = '#8fd3a5', dotClosed = '#8a8079' }) {
  const [status, setStatus] = useState(initial);
  useEffect(() => {
    const tick = () => setStatus(storeStatus({ hours }));
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 60 * 1000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [hours]);
  if (!status) return <span className={className}>Nyitvatartás hamarosan</span>;
  return (
    <span className={className} aria-live="polite" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: status.open ? dotOpen : dotClosed, flex: 'none' }} />
      {status.text}
    </span>
  );
}
