"use client";
import { useState } from 'react';
import { STORE_NAMES } from '@/lib/permissions';
import { storeHoursOn, TABLE_NOTE_MAX, TABLE_MAX_PEOPLE } from '@/lib/tableBookings';
import s from './TableBookingPage.module.css';

const EMPTY = { name: '', email: '', phone: '', date: '', from: '', to: '', maxPeople: '', note: '', website: '' };

// Nyilvános asztalfoglaló oldal: a kérés addig nem él, amíg egy szervező el nem fogadja
// embed: a weboldal ablakában (a nagy fejléc csak a felolvasóknak, szorosabb térközök)
export default function TableBookingPage({ maintenance = false, initialStore = '', embed = false }) {
  const [form, setForm] = useState({ ...EMPTY, store: initialStore });
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState(null); // { error, field }
  const [done, setDone] = useState(null);

  const set = (key) => (ev) => { setForm(f => ({ ...f, [key]: ev.target.value })); setProblem(null); };
  const hours = storeHoursOn(form.store, form.date);
  const invalid = (field) => (problem?.field === field ? { 'aria-invalid': true, 'aria-describedby': 'hiba' } : {});

  const submit = async (ev) => {
    ev.preventDefault();
    setSubmitting(true);
    setProblem(null);
    try {
      const res = await fetch('/api/table-bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) setProblem({ error: data.error || 'A foglalás most nem sikerült. Próbáld újra később.', field: data.field });
      else setDone({ ...form, mailSent: data.mailSent });
    } catch {
      setProblem({ error: 'Hálózati hiba. Ellenőrizd a kapcsolatot, és próbáld újra.' });
    } finally {
      setSubmitting(false);
    }
  };

  const header = (
    <header className={embed ? s.srOnly : s.header}>
      <p className={s.kicker}>Tavern</p>
      <h1 className={s.title}>Asztalfoglalás</h1>
    </header>
  );

  if (maintenance) {
    return <main className={`${s.page} ${embed ? s.embed : ''}`}><div className={s.box}>{header}<p className={s.panel}>A foglalás átmenetileg nem elérhető. Kérjük, nézz vissza később!</p></div></main>;
  }

  if (done) {
    return (
      <main className={`${s.page} ${embed ? s.embed : ''}`}>
        <div className={s.box}>
          {header}
          <div className={s.panel} role="status">
            <h2 className={s.doneTitle}>Megkaptuk a kérésedet</h2>
            <p>{STORE_NAMES[done.store]}, {done.date}, {done.from}–{done.to}, legfeljebb {done.maxPeople} fő</p>
            <p>A foglalás akkor él, ha visszaigazoljuk. {done.mailSent ? `A visszaigazolást a(z) ${done.email} címre küldjük.` : 'A megadott elérhetőségeiden keresünk.'}</p>
            <button type="button" className={s.secondary} onClick={() => { setDone(null); setForm({ ...EMPTY, store: done.store }); }}>Újabb foglalás</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={`${s.page} ${embed ? s.embed : ''}`}>
      <div className={s.box}>
        {header}
        <form className={s.panel} onSubmit={submit} noValidate>
          <fieldset className={s.fieldset} {...invalid('store')}>
            <legend className={s.label}>Bolt</legend>
            <div className={s.stores}>
              {Object.entries(STORE_NAMES).map(([id, name]) => (
                <label key={id} className={s.store}>
                  <input type="radio" name="store" value={id} checked={form.store === id} onChange={set('store')} />
                  <span>{name}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className={s.field}>
            <span className={s.label}>Nap</span>
            <input className={s.input} type="date" value={form.date} onChange={set('date')} required {...invalid('date')} />
            {hours === null && <small className={s.warn}>A bolt ezen a napon zárva van.</small>}
            {hours && <small className={s.hint}>Nyitvatartás ezen a napon: {hours[0]}–{hours[1]}</small>}
          </label>

          <div className={s.times}>
            <label className={s.field}>
              <span className={s.label}>Kezdés</span>
              <input className={s.input} type="time" step="900" value={form.from} onChange={set('from')} required {...invalid('from')} />
            </label>
            <label className={s.field}>
              <span className={s.label}>Befejezés</span>
              <input className={s.input} type="time" step="900" value={form.to} onChange={set('to')} required {...invalid('to')} />
            </label>
          </div>

          <label className={s.field}>
            <span className={s.label}>Maximum hányan lesztek?</span>
            <input className={s.input} type="number" inputMode="numeric" name="maxPeople" min={1} max={TABLE_MAX_PEOPLE} step={1} value={form.maxPeople} onChange={set('maxPeople')} required {...invalid('maxPeople')} />
          </label>

          <label className={s.field}>
            <span className={s.label}>Név</span>
            <input className={s.input} type="text" autoComplete="name" maxLength={120} value={form.name} onChange={set('name')} required {...invalid('name')} />
          </label>
          <label className={s.field}>
            <span className={s.label}>E-mail cím</span>
            <input className={s.input} type="email" inputMode="email" autoComplete="email" value={form.email} onChange={set('email')} required {...invalid('email')} />
          </label>
          <label className={s.field}>
            <span className={s.label}>Telefonszám</span>
            <input className={s.input} type="tel" inputMode="tel" autoComplete="tel" placeholder="+36 30 123 4567" value={form.phone} onChange={set('phone')} required {...invalid('phone')} />
          </label>
          <label className={s.field}>
            <span className={s.label}>Megjegyzés (nem kötelező)</span>
            <textarea className={s.input} rows={3} maxLength={TABLE_NOTE_MAX} value={form.note} onChange={set('note')} />
          </label>

          {/* Rejtett mező a robotok ellen */}
          <input className={s.trap} type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={set('website')} />

          {problem && <p id="hiba" className={s.error} role="alert">{problem.error}</p>}
          <button type="submit" className={s.primary} disabled={submitting} aria-busy={submitting || undefined} data-kuldes>
            {submitting && <span className={s.spinner} aria-hidden="true" />}
            <span>{submitting ? 'Küldés…' : 'Foglalás elküldése'}</span>
          </button>
          <p className={s.privacy}>
            Az adataidat csak a bolt munkatársai látják, és kizárólag a foglalás intézéséhez használjuk. Az időpont után legfeljebb két hónappal töröljük őket.
            {process.env.NEXT_PUBLIC_PRIVACY_URL && <> <a href={process.env.NEXT_PUBLIC_PRIVACY_URL} target="_blank" rel="noopener noreferrer">Adatkezelési tájékoztató</a></>}
          </p>
        </form>
      </div>
    </main>
  );
}
