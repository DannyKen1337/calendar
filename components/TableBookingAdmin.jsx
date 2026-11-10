"use client";
import { useState } from 'react';
import { Popconfirm } from 'antd';
import { STORES } from '@/app/components';
import { eventDay } from '@/lib/occupancy';
import s from './TableBookingAdmin.module.css';

const DEFAULT_SEATS = 4;
const dayLabel = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('hu-HU', { month: 'long', day: 'numeric', weekday: 'long' }).replace(/^./, c => c.toUpperCase());
const STATUS_LABELS = { accepted: 'Elfogadva', rejected: 'Elutasítva', cancelled: 'Lemondva' };

// Asztalfoglalási kérések kezelése az admin felületen (jog: „Asztalfoglalás”, a szervező a saját boltjaiban).
// Elfogadáskor a szervező dönti el, hány helyet foglal (alapból a megadott maximális létszám); a foglalás innentől a naptárban is látszik (lib/tableBookings.js).
function BookingCard({ b, app, todayKey }) {
  const [seats, setSeats] = useState(String(b.maxPeople || DEFAULT_SEATS));
  const [busy, setBusy] = useState(false);
  const eventsThatDay = (app.tournaments || []).filter(e => (e.store || 'debrecen') === b.store && eventDay(e) === b.date).length;
  const othersThatDay = (app.tableBookings || []).filter(o => o.status === 'accepted' && o.store === b.store && o.date === b.date && o.id !== b.id).length;
  const past = b.date < todayKey;

  const decide = async (decision) => {
    setBusy(true);
    try {
      const res = await app.decideTableBooking(b.id, decision, decision === 'accept' ? { seats: Number(seats) } : {});
      if (res) {
        const done = decision === 'accept' ? 'Foglalás elfogadva.' : decision === 'reject' ? 'Kérés elutasítva.' : 'Foglalás lemondva.';
        app.messageApi?.success(res.mailSent ? `${done} Az e-mailt elküldtük.` : `${done} E-mailt nem küldtünk, értesítsd telefonon.`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={s.card}>
      <div className={s.head}>
        <b>{dayLabel(b.date)} · {b.from}–{b.to}</b>
        {b.status !== 'pending' && <span className={`${s.pill} ${b.status === 'accepted' ? s.pillOk : ''}`}>{STATUS_LABELS[b.status]}</span>}
      </div>
      <p className={s.line}>{STORES[b.store]?.name}</p>
      <p className={s.line}><b>{b.name}</b>{b.maxPeople ? ` · legfeljebb ${b.maxPeople} fő` : ''}</p>
      <p className={s.line}><a href={`tel:${b.phone.replace(/[^\d+]/g, '')}`}>{b.phone}</a> · <a href={`mailto:${b.email}`}>{b.email}</a></p>
      {b.note && <p className={s.note}>{b.note}</p>}
      {b.status === 'pending' && <p className={s.quiet}>{past ? 'Ez az időpont már elmúlt. ' : ''}Aznap a boltban: {eventsThatDay} esemény, {othersThatDay} elfogadott foglalás.</p>}
      {b.status === 'accepted' && b.seats && <p className={s.quiet}>{b.seats} hely · {b.decidedBy}</p>}
      {b.status === 'rejected' && b.decidedBy && <p className={s.quiet}>{b.decidedBy}</p>}
      {b.status === 'pending' && (
        <div className={s.actions}>
          {!past && (
            <>
              <div className={s.seats} role="group" aria-label="Foglalt helyek">
                <button type="button" className={s.step} aria-label="Eggyel kevesebb hely" disabled={busy || Number(seats) <= 1} onClick={() => setSeats(v => String(Math.max(1, (Number(v) || 1) - 1)))}>−</button>
                <label className={s.seatsLabel}>
                  <span>Hely</span>
                  <input type="number" inputMode="numeric" min={1} max={500} value={seats} onFocus={(ev) => ev.target.select()} onChange={(ev) => setSeats(ev.target.value)} aria-label="Foglalt helyek száma" />
                </label>
                <button type="button" className={s.step} aria-label="Eggyel több hely" disabled={busy || Number(seats) >= 500} onClick={() => setSeats(v => String(Math.min(500, (Number(v) || 0) + 1)))}>+</button>
              </div>
              <button type="button" className={s.accept} disabled={busy} onClick={() => decide('accept')}>Elfogadás</button>
            </>
          )}
          <Popconfirm title="Elutasítod ezt a kérést?" okText="Elutasítás" cancelText="Mégse" okButtonProps={{ danger: true }} onConfirm={() => decide('reject')}>
            <button type="button" className={s.reject} disabled={busy}>Elutasítás</button>
          </Popconfirm>
        </div>
      )}
      {b.status === 'accepted' && !past && (
        <div className={s.actions}>
          <Popconfirm title="Lemondod ezt a foglalást?" description="A naptárból is eltűnik." okText="Lemondás" cancelText="Mégse" okButtonProps={{ danger: true }} onConfirm={() => decide('cancel')}>
            <button type="button" className={s.reject} disabled={busy}>Foglalás lemondása</button>
          </Popconfirm>
        </div>
      )}
    </article>
  );
}

export default function TableBookingAdmin({ app, todayKey }) {
  const [showClosed, setShowClosed] = useState(false);
  const all = app.tableBookings || [];
  const byTime = (a, b) => `${a.date}${a.from}`.localeCompare(`${b.date}${b.from}`);
  const pending = all.filter(b => b.status === 'pending').sort(byTime);
  const accepted = all.filter(b => b.status === 'accepted' && b.date >= todayKey).sort(byTime);
  const closed = all.filter(b => !pending.includes(b) && !accepted.includes(b)).sort((a, b) => byTime(b, a));
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/asztalfoglalas`); app.messageApi?.success('Link kimásolva.'); }
    catch { app.messageApi?.error('Nem sikerült kimásolni.'); }
  };
  const list = (items) => items.map(b => <BookingCard key={b.id} b={b} app={app} todayKey={todayKey} />);

  return (
    <div className={s.wrap}>
      <div className={s.linkRow}>
        <span className={s.quiet}>Nyilvános oldal: <a href="/asztalfoglalas" target="_blank" rel="noopener noreferrer">/asztalfoglalas</a></span>
        <button type="button" className={s.copy} onClick={copyLink}>Link másolása</button>
      </div>
      <h2 className={s.group}>Elfogadásra vár ({pending.length})</h2>
      {pending.length ? list(pending) : <p className={s.empty}>Nincs új kérés.</p>}
      <h2 className={s.group}>Közelgő foglalások ({accepted.length})</h2>
      {accepted.length ? list(accepted) : <p className={s.empty}>Nincs elfogadott közelgő foglalás.</p>}
      {closed.length > 0 && (
        <>
          <button type="button" className={s.copy} aria-expanded={showClosed} onClick={() => setShowClosed(v => !v)}>{showClosed ? 'Korábbiak elrejtése' : `Korábbiak mutatása (${closed.length})`}</button>
          {showClosed && list(closed)}
        </>
      )}
    </div>
  );
}
