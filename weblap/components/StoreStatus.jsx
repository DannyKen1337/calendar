"use client";
import { useEffect, useState } from 'react';
import { storeStatus } from '@/weblap/lib/stores';
import s from '@/weblap/fooldal.module.css';

// Egy bolt "nyitva / zárva" állapota: a szerver kiszámolja (JavaScript nélkül is látszik), a böngésző percenként frissíti.
// Nyitva: lüktető pont, és a böngészőben a zárásig hátralévő idő („még 3 óra 12 perc”).
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
      <span aria-hidden="true" className={status.open ? s.openDot : undefined} style={{ width: 9, height: 9, borderRadius: '50%', background: status.open ? dotOpen : dotClosed, flex: 'none' }} />
      {status.text}
      {status.open && Number.isInteger(status.closesIn) && <span className={s.closesIn} data-zarasig aria-hidden="true">· még {status.closesIn >= 60 ? `${Math.floor(status.closesIn / 60)} óra${status.closesIn % 60 ? ` ${status.closesIn % 60} perc` : ''}` : `${status.closesIn} perc`}</span>}
    </span>
  );
}
