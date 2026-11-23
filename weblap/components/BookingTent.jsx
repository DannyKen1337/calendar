"use client";
import { useEffect, useRef, useState } from 'react';
import TableTent from '@/weblap/components/TableTent';
import s from '@/weblap/fooldal.module.css';

// A foglalás blokkjának „FOGLALT” táblája. Sikeres asztalfoglalás után (az ablak bezárásakor: Overlays → „tavern:foglalva”)
// a tábla felbillen, aranyszikrák pattannak, és alatta megjelenik a foglalás (bolt, nap, időpont, létszám): egyértelmű megerősítés,
// hogy a kérés átment. Csökkentett mozgásnál csak a felirat változik.
const fmtDay = (iso) => { try { return new Date(`${iso}T12:00:00`).toLocaleDateString('hu-HU', { month: 'long', day: 'numeric', weekday: 'long' }); } catch { return iso; } };

export default function BookingTent() {
  const [booking, setBooking] = useState(null); // { text, n }
  const scene = useRef(null);

  useEffect(() => {
    const on = (e) => {
      const d = e.detail || {};
      const text = [d.store, [d.date && fmtDay(d.date), d.from].filter(Boolean).join(' '), d.people && `${d.people} fő`].filter(Boolean).join(' · ');
      setBooking(b => ({ text, n: (b?.n || 0) + 1 }));
    };
    addEventListener('tavern:foglalva', on);
    return () => removeEventListener('tavern:foglalva', on);
  }, []);

  useEffect(() => {
    const el = scene.current;
    if (!booking || !el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const tent = el.querySelector('[data-tabla]');
    tent?.animate([
      { transform: 'perspective(700px) rotateX(82deg)', opacity: 0.3 },
      { transform: 'perspective(700px) rotateX(-10deg)', opacity: 1, offset: 0.62 },
      { transform: 'perspective(700px) rotateX(0)', opacity: 1 },
    ], { duration: 850, delay: 250, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.1)', fill: 'backwards' });
    for (let i = 0; i < 12; i++) {
      const spark = document.createElement('i');
      spark.className = s.tentSpark;
      el.appendChild(spark);
      const ang = (Math.PI * 2 * i) / 12, dist = 70 + (i % 3) * 22;
      spark.animate([
        { transform: 'translate(-50%, -50%) scale(1.4)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(ang) * dist}px), calc(-50% + ${Math.sin(ang) * dist}px)) scale(0.2)`, opacity: 0 },
      ], { duration: 750, delay: 820, easing: 'ease-out', fill: 'both' }).finished.then(() => spark.remove()).catch(() => spark.remove());
    }
  }, [booking]);

  // a megerősítés a jelenet alatt, külön sorban (a foglalás rácsában: gépen a tábla alatt, telefonon közvetlenül utána)
  return (
    <>
      <div className={s.bookingScene} ref={scene} data-foglalva={booking ? '' : undefined}>
        <TableTent />
      </div>
      {booking && (
        <p className={s.bookedNote} role="status" data-foglalas-kesz>
          <b>Elküldtük a foglalásodat.</b>
          {booking.text && <span data-tabla-adat>{booking.text}</span>}
          <span>Ha visszaigazoljuk, él.</span>
        </p>
      )}
    </>
  );
}
