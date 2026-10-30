"use client";
import { useState } from 'react';
import { ConfigProvider, Popconfirm } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { tavernTheme, STORES } from '@/app/components';
import { dayOccupancy, eventDay, eventSeats, STORE_IDS } from '@/lib/occupancy';
import s from './OccupancyManager.module.css';

// Napi telítettség kezelése (lib/occupancy.js): egy bolt egy napja – a versenyek jelentkezői, a kézi helyfoglalások
// (felvétel, szerkesztés, bővítés/szűkítés, törlés), és a tulajdonosnak a modul kapcsolója meg a boltok napi férőhelye.
// A tulajdonosi admin (OwnerAdmin) és a /admin/telitettseg oldal is ezt használja.

const MONTHS = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
const DAYS = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shiftDay = (key, n) => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate() + n); return keyOf(d); };
const EMPTY_FORM = { label: '', from: '18:00', to: '20:00', seats: '4' };

export default function OccupancyManager({ app }) {
  const isOwner = app.userRole === 'owner';
  const occ = app.occupancy || { enabled: false, public: false, capacity: {} };
  const stores = STORE_IDS.filter(id => isOwner || app.canManageStore(id));
  const [store, setStore] = useState(stores[0] || 'debrecen');
  const [day, setDay] = useState(() => keyOf(new Date()));
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null); // a szerkesztett foglalás azonosítója
  const [busy, setBusy] = useState(false);
  const [caps, setCaps] = useState(() => Object.fromEntries(STORE_IDS.map(id => [id, occ.capacity?.[id] ?? ''])));

  if (!isOwner && !occ.enabled) {
    return <div className={s.page}><p className={s.notice}>A napi telítettség modul ki van kapcsolva.</p></div>;
  }

  const todayKey = keyOf(new Date());
  const date = new Date(`${day}T12:00:00`);
  const dayLabel = `${day === todayKey ? 'Ma · ' : day === shiftDay(todayKey, 1) ? 'Holnap · ' : ''}${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}.`;
  const bookings = (app.bookings || []).filter(b => b.store === store && b.date === day).sort((a, b) => a.from.localeCompare(b.from));
  const events = (app.tournaments || []).filter(e => (e.store || 'debrecen') === store && eventDay(e) === day && eventSeats(e) > 0)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const o = dayOccupancy({ store, day, tournaments: app.tournaments, bookings: app.bookings, capacity: occ.capacity });
  const cap = o.cap;
  const evPct = cap ? Math.min(100, (o.events / cap) * 100) : 0;
  const manPct = cap ? Math.min(100 - evPct, (o.manual / cap) * 100) : 0;

  const run = async (fn) => { setBusy(true); try { return await fn(); } finally { setBusy(false); } };
  const submit = async (e) => {
    e.preventDefault();
    const payload = { store, date: day, label: form.label, from: form.from, to: form.to, seats: Number(form.seats), ...(editing ? { id: editing } : {}) };
    if (await run(() => app.saveBooking(payload))) { setForm(EMPTY_FORM); setEditing(null); }
  };
  const startEdit = (b) => { setEditing(b._id); setForm({ label: b.label, from: b.from, to: b.to, seats: String(b.seats) }); };
  const changeSeats = (b, delta) => run(() => app.saveBooking({ id: b._id, store: b.store, date: b.date, label: b.label, from: b.from, to: b.to, seats: Math.max(1, b.seats + delta) }));

  return (
    <ConfigProvider theme={tavernTheme}>
      <div className={s.page}>
        {isOwner && (
          <section className={s.card} aria-label="Telítettség modul">
            <div className={s.row}>
              <span className={s.grow}>
                <b>Telítettség modul</b>
                <span className={s.faint}>{occ.enabled ? (occ.public ? 'Bekapcsolva: a szervezők és a nyilvános naptár látogatói is látják.' : 'Bekapcsolva: a szervezők is látják az admin felületen.') : 'Kikapcsolva: csak te látod (tulajdonos).'}</span>
              </span>
              <button type="button" role="switch" aria-checked={occ.enabled} aria-label="Telítettség modul" disabled={busy}
                className={`${s.switch} ${occ.enabled ? s.switchOn : ''}`} onClick={() => run(() => app.saveOccupancy({ enabled: !occ.enabled }))}><span /></button>
            </div>
            {occ.enabled && (
              <label className={s.check}>
                <input type="checkbox" checked={occ.public} disabled={busy} onChange={(e) => run(() => app.saveOccupancy({ public: e.target.checked }))} />
                A nyilvános naptárban is látszik
              </label>
            )}
          </section>
        )}

        {stores.length > 1 && (
          <div className={s.segment} role="group" aria-label="Bolt">
            {stores.map(id => <button key={id} type="button" aria-pressed={store === id} onClick={() => { setStore(id); setEditing(null); setForm(EMPTY_FORM); }}>{STORES[id]?.name.replace('Tavern ', '')}</button>)}
          </div>
        )}

        <div className={s.dayNav}>
          <button type="button" className={s.iconBtn} aria-label="Előző nap" onClick={() => setDay(d => shiftDay(d, -1))}><LeftOutlined /></button>
          <span className={s.dayLabel}>
            {dayLabel}
            {day !== todayKey && <button type="button" className={s.linkBtn} onClick={() => setDay(todayKey)}>Vissza a mai napra</button>}
          </span>
          <button type="button" className={s.iconBtn} aria-label="Következő nap" onClick={() => setDay(d => shiftDay(d, 1))}><RightOutlined /></button>
        </div>

        <section className={s.card} aria-label="Összesítés">
          {cap ? (
            <>
              <div className={s.row} style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className={`${s.big} ${s.num}`}>{o.used} / {cap} <span style={{ fontSize: 15, fontWeight: 600, color: '#b8aca7' }}>hely</span></span>
                <b className={s.num} style={{ fontSize: 18, color: o.over ? '#ef7b74' : '#e5b15d' }}>{o.pct}%</b>
              </div>
              <span className={s.bar} aria-hidden="true">
                <span style={{ width: `${evPct}%`, background: o.over ? '#ef7b74' : '#e5b15d' }} />
                <span style={{ width: `${manPct}%`, background: o.over ? '#f2a49f' : '#d9cdc8' }} />
              </span>
              <span className={`${s.muted} ${s.num}`}>{o.events} versenyző · {o.manual} kézi foglalás · {o.free} szabad</span>
              {o.over && <span className={s.warn}>Túlfoglalás: {o.used - cap} hellyel több, mint a bolt férőhelye.</span>}
            </>
          ) : (
            <p className={s.notice} style={{ margin: 0 }}>Ehhez a bolthoz még nincs megadva napi férőhely{isOwner ? ' (lent állíthatod be)' : ''}. A foglalások addig is rögzíthetők.</p>
          )}
        </section>

        <h2 className={s.h2}>Versenyek (a jelentkezésekből)</h2>
        {events.length ? (
          <ul className={s.list}>
            {events.map(e => (
              <li key={String(e._id || e.id)} className={s.listRow}>
                <b className={s.num} style={{ width: 48 }}>{String(e.date).slice(11, 16)}</b>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                <b className={s.num}>{eventSeats(e)} fő</b>
              </li>
            ))}
          </ul>
        ) : <p className={s.notice} style={{ margin: 0 }}>Ezen a napon nincs verseny jelentkezőkkel.</p>}

        <h2 className={s.h2}>Kézi foglalások</h2>
        {bookings.length ? bookings.map(b => (
          <div key={b._id} className={s.booking}>
            <div className={s.row} style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <b style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.label}</b>
              <span className={`${s.muted} ${s.num}`} style={{ whiteSpace: 'nowrap' }}>{b.from}–{b.to}</span>
            </div>
            <div className={s.row}>
              <span className={s.stepper}>
                <button type="button" className={s.stepBtn} aria-label="Eggyel kevesebb hely" disabled={busy || b.seats <= 1} onClick={() => changeSeats(b, -1)}>−</button>
                <b className={s.num} style={{ minWidth: 64, textAlign: 'center' }}>{b.seats} hely</b>
                <button type="button" className={s.stepBtn} aria-label="Eggyel több hely" disabled={busy} onClick={() => changeSeats(b, 1)}>+</button>
              </span>
              <span style={{ marginLeft: 'auto', display: 'flex' }}>
                <button type="button" className={s.textBtn} onClick={() => startEdit(b)}>Szerkesztés</button>
                <Popconfirm title="Törlöd ezt a foglalást?" okText="Törlés" cancelText="Mégse" okButtonProps={{ danger: true }} onConfirm={() => run(() => app.deleteBooking(b._id))}>
                  <button type="button" className={`${s.textBtn} ${s.danger}`}>Törlés</button>
                </Popconfirm>
              </span>
            </div>
            {b.createdBy && <span className={s.faint}>Felvette: {b.createdBy}{b.updatedBy ? ` · módosította: ${b.updatedBy}` : ''}</span>}
          </div>
        )) : <p className={s.notice} style={{ margin: 0 }}>Erre a napra nincs kézi foglalás.</p>}

        <form className={`${s.card} ${s.form}`} onSubmit={submit} aria-labelledby="uj-foglalas">
          <b id="uj-foglalas">{editing ? 'Foglalás szerkesztése' : 'Új helyfoglalás'}</b>
          <label className={s.field}>Kinek / mire
            <input value={form.label} maxLength={80} required placeholder="Pl. Társasjáték-csoport (Kovács)" onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))} />
          </label>
          <div className={s.fields3}>
            <label className={s.field}>Kezdés<input type="time" value={form.from} required onChange={(e) => setForm(f => ({ ...f, from: e.target.value }))} /></label>
            <label className={s.field}>Vége<input type="time" value={form.to} required onChange={(e) => setForm(f => ({ ...f, to: e.target.value }))} /></label>
            <label className={s.field}>Hely<input type="number" inputMode="numeric" min={1} max={500} value={form.seats} required onChange={(e) => setForm(f => ({ ...f, seats: e.target.value }))} /></label>
          </div>
          {editing ? (
            <div className={s.actions}>
              <button type="button" className={s.secondary} onClick={() => { setEditing(null); setForm(EMPTY_FORM); }}>Mégse</button>
              <button className={s.primary} disabled={busy}>Mentés</button>
            </div>
          ) : (
            <button className={s.primary} disabled={busy}>Foglalás mentése</button>
          )}
        </form>

        {isOwner && (
          <section className={s.card} aria-labelledby="ferohely">
            <span className={s.grow}>
              <b id="ferohely">A boltok napi férőhelye</b>
              <span className={s.faint}>Boltonként egyszer állítod be, minden napra érvényes. A napi telítettség ehhez mérődik.</span>
            </span>
            {STORE_IDS.map(id => (
              <label key={id} className={s.capRow}>
                <span>{STORES[id]?.name}</span>
                <input type="number" inputMode="numeric" min={1} max={1000} placeholder="—" value={caps[id]} aria-label={`${STORES[id]?.name} napi férőhelye (fő)`}
                  onChange={(e) => setCaps(c => ({ ...c, [id]: e.target.value }))} />
              </label>
            ))}
            <button type="button" className={s.secondary} disabled={busy}
              onClick={() => run(() => app.saveOccupancy({ capacity: Object.fromEntries(STORE_IDS.map(id => [id, caps[id] === '' ? null : Number(caps[id])])) }))}>
              Férőhelyek mentése
            </button>
          </section>
        )}
      </div>
    </ConfigProvider>
  );
}
