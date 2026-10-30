"use client";
import { useActionState, useEffect, useState } from 'react';
import { tabByKey, emptyValue } from '@/weblap/lib/contentSchema';
import { withBase } from '@/weblap/lib/basePath';
import { saveContentAction, uploadImageAction } from './actions';

// Az oldal tartalmának egy füle (Általános, Nyitókép, Kínálat, ...). Az űrlapot a fül sémája rajzolja ki
// (weblap/lib/contentSchema.js); mentéskor a teljes fül JSON-ban megy a szervernek, ami a séma szerint ellenőrzi.
// s: az admin CSS-modulja; tabKey: a fül kulcsa; initial: a fül mostani tartalma; updated: { at, by } az utolsó mentésről
export default function ContentEditor({ s, tabKey, initial, updated }) {
  const tab = tabByKey(tabKey);
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [last, setLast] = useState(updated);
  const [state, action, pending] = useActionState(saveContentAction, null);
  const [applied, setApplied] = useState(null);

  // Sikeres mentés után a szerver által ellenőrzött (pl. új azonosítókkal kiegészített) tartalom lesz az alap
  if (state?.ok && state.at !== applied) {
    setApplied(state.at);
    setValue(state.data);
    setSaved(state.data);
    setLast({ at: new Date(state.at).toISOString(), by: null });
  }

  const dirty = JSON.stringify(value) !== JSON.stringify(saved);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  return (
    <form action={action} className={s.form}>
      <input type="hidden" name="tab" value={tabKey} />
      <input type="hidden" name="payload" value={JSON.stringify(value)} />
      <Field f={tab.schema} value={value} onChange={setValue} s={s} top />
      <div className={s.saveBar}>
        <button className={s.primary} disabled={pending || !dirty}>{pending ? 'Mentés…' : 'Mentés'}</button>
        <p className={s.saveStatus} role="status">
          {state?.error && !pending
            ? <span className={s.error}>{state.error.split('\n').map((l, i) => <span key={i} className={s.errorLine}>{l}</span>)}</span>
            : dirty ? <span className={s.flag}>Nem mentett módosítások</span>
            : state?.ok ? <span className={s.ok}>Mentve, az oldalon már látszik.</span>
            : last?.at ? <span className={s.muted}>Utoljára mentve: {new Date(last.at).toLocaleString('hu-HU', { dateStyle: 'medium', timeStyle: 'short' })}{last.by ? ` (${last.by})` : ''}{last.reset ? ', visszaállítva az eredetire' : ''}</span>
            : <span className={s.muted}>Még az eredeti tartalom.</span>}
        </p>
      </div>
    </form>
  );
}

function Field({ f, value, onChange, s, top }) {
  switch (f.type) {
    case 'text':
    case 'url':
      return (
        <label className={s.field}>
          <span>{f.label}</span>
          <input value={value ?? ''} maxLength={f.type === 'text' ? f.max : 500} placeholder={f.type === 'url' ? 'https://' : undefined}
            inputMode={f.type === 'url' ? 'url' : undefined} onChange={(e) => onChange(e.target.value)} />
          {f.help && <small>{f.help}</small>}
        </label>
      );
    case 'textarea':
      return (
        <label className={s.field}>
          <span>{f.label}</span>
          <textarea value={value ?? ''} maxLength={f.max} rows={f.rows} className={s.textareaAuto} onChange={(e) => onChange(e.target.value)} />
          {f.help && <small>{f.help}</small>}
        </label>
      );
    case 'bool':
      return <label className={s.check}><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> {f.label}</label>;
    case 'image':
    case 'src':
      return <ImageField f={f} value={value} onChange={onChange} s={s} />;
    case 'hours':
      return <HoursField f={f} value={value} onChange={onChange} s={s} />;
    case 'strings':
      return <StringsField f={f} value={value} onChange={onChange} s={s} />;
    case 'list':
      return <ListField f={f} value={value} onChange={onChange} s={s} />;
    case 'object': {
      const inner = Object.entries(f.fields).map(([k, sub]) => (
        <Field key={k} f={sub} value={value?.[k]} onChange={(v) => onChange({ ...value, [k]: v })} s={s} />
      ));
      if (top || !f.label) return <div className={s.fields}>{inner}</div>;
      if (f.collapsible) {
        return (
          <details className={s.group}>
            <summary className={s.groupSummary}>{f.label}</summary>
            <div className={s.fields}>{inner}</div>
          </details>
        );
      }
      return (
        <fieldset className={s.group}>
          <legend className={s.legend}>{f.label}</legend>
          <div className={f.compact ? s.grid : s.fields}>{inner}</div>
        </fieldset>
      );
    }
    default:
      return null;
  }
}

// Kép: előnézet (kattintással kijelölhető, hova essen a kép közepe), cím vagy feltöltés, és képleírás
function ImageField({ f, value, onChange, s }) {
  const onlySrc = f.type === 'src';
  const v = onlySrc ? { src: value || '' } : { ...emptyValue(f), ...value };
  const set = (patch) => onChange(onlySrc ? patch.src : { ...v, ...patch });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const canPick = !onlySrc && !f.noPosition && !!v.src;
  const [px, py] = (v.position || '50% 50%').split(' ');

  async function upload(file) {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { setError('A kép legfeljebb 4 MB lehet.'); return; }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await uploadImageAction(fd);
      if (res?.url) set({ src: res.url });
      else setError(res?.error || 'Nem sikerült feltölteni a képet.');
    } catch {
      setError('Nem sikerült feltölteni a képet. Próbáld újra.');
    } finally {
      setBusy(false);
    }
  }

  function pick(e) {
    if (!canPick) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * 100);
    const y = Math.round(Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) * 100);
    set({ position: `${x}% ${y}%` });
  }

  return (
    <div className={`${s.field} ${onlySrc ? s.imageCompact : ''}`}>
      <span>{f.label}</span>
      <div className={s.imageRow}>
        <div className={`${s.imageBox} ${canPick ? s.imageBoxPick : ''}`} onClick={pick} title={canPick ? 'Kattints oda, ahol a kép közepe legyen' : undefined}>
          {v.src
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={withBase(v.src)} alt="" style={{ objectPosition: v.position, objectFit: f.noPosition ? 'contain' : 'cover' }} referrerPolicy="no-referrer" />
            : <span className={s.muted}>Nincs kép</span>}
          {canPick && <i className={s.imageDot} style={{ left: px, top: py }} aria-hidden="true" />}
        </div>
        <div className={s.imageInputs}>
          <input value={v.src} onChange={(e) => set({ src: e.target.value })} placeholder="https://…" aria-label={`${f.label}: a kép címe`} />
          <label className={s.small}>
            {busy ? 'Feltöltés…' : 'Kép feltöltése'}
            <input type="file" accept="image/*" hidden disabled={busy} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          {!onlySrc && <input value={v.alt} maxLength={300} onChange={(e) => set({ alt: e.target.value })} placeholder="Mi látható a képen? (képleírás)" aria-label={`${f.label}: képleírás`} />}
        </div>
      </div>
      {error && <small className={s.error}>{error}</small>}
      {f.help && <small>{f.help}</small>}
    </div>
  );
}

const DAY_NAMES = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat'];
const WEEK = [1, 2, 3, 4, 5, 6, 0];

// Heti nyitvatartás: naponként nyitva (nyitás–zárás) vagy zárva
function HoursField({ f, value, onChange, s }) {
  const h = value || emptyValue(f);
  const lastOpen = WEEK.map(d => h[d]).find(Boolean) || ['10:00', '18:00'];
  const setDay = (d, v) => onChange({ ...h, [d]: v });
  return (
    <fieldset className={s.group}>
      <legend className={s.legend}>{f.label}</legend>
      <div className={s.hours}>
        {WEEK.map(d => (
          <div key={d} className={s.hoursRow}>
            <label className={s.check}>
              <input type="checkbox" checked={!!h[d]} onChange={(e) => setDay(d, e.target.checked ? [...lastOpen] : null)} />
              {DAY_NAMES[d]}
            </label>
            {h[d] ? (
              <span className={s.hoursTimes}>
                <input type="time" value={h[d][0]} aria-label={`${DAY_NAMES[d]}: nyitás`} onChange={(e) => setDay(d, [e.target.value, h[d][1]])} />
                –
                <input type="time" value={h[d][1]} aria-label={`${DAY_NAMES[d]}: zárás`} onChange={(e) => setDay(d, [h[d][0], e.target.value])} />
              </span>
            ) : <span className={s.muted}>zárva</span>}
          </div>
        ))}
      </div>
      {f.help && <small className={s.muted}>{f.help}</small>}
    </fieldset>
  );
}

// Rövid szövegek listája (pl. a szavak a cégér alatt)
function StringsField({ f, value, onChange, s }) {
  const list = value || [];
  return (
    <fieldset className={s.group}>
      <legend className={s.legend}>{f.label}</legend>
      <div className={s.strings}>
        {list.map((w, i) => (
          <span key={i} className={s.stringItem}>
            <input value={w} maxLength={f.itemMax} aria-label={`${f.label} ${i + 1}.`} onChange={(e) => onChange(list.map((x, j) => (j === i ? e.target.value : x)))} />
            <button type="button" className={s.iconBtn} aria-label="Törlés" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
          </span>
        ))}
        {list.length < f.max && <button type="button" className={s.small} onClick={() => onChange([...list, ''])}>+ Új</button>}
      </div>
    </fieldset>
  );
}

// Ismétlődő elemek (kínálat csoportjai és tételei, lábléc linkjei): hozzáadás, sorrend, törlés
function ListField({ f, value, onChange, s }) {
  const list = value || [];
  const [fresh, setFresh] = useState(null);
  const move = (i, d) => {
    const a = [...list];
    [a[i], a[i + d]] = [a[i + d], a[i]];
    onChange(a);
  };
  const remove = (i) => {
    const title = list[i][f.titleKey] || `ez a(z) ${f.itemLabel}`;
    if (window.confirm(`Biztosan törlöd? „${title}”`)) onChange(list.filter((_, j) => j !== i));
  };
  const add = () => {
    const id = `uj-${Math.random().toString(36).slice(2, 8)}`;
    onChange([...list, { ...emptyValue(f.item), id }]);
    setFresh(id);
  };
  // A gombok a lenyitható fejlécben is vannak: a kattintás ne nyissa / zárja a fejlécet
  const tap = (fn) => (e) => { e.preventDefault(); fn(); };
  const tools = (i) => (
    <span className={s.listTools}>
      <button type="button" className={s.iconBtn} disabled={i === 0} aria-label="Feljebb" onClick={tap(() => move(i, -1))}>↑</button>
      <button type="button" className={s.iconBtn} disabled={i === list.length - 1} aria-label="Lejjebb" onClick={tap(() => move(i, 1))}>↓</button>
      <button type="button" className={`${s.iconBtn} ${s.danger}`} aria-label="Törlés" onClick={tap(() => remove(i))}>✕</button>
    </span>
  );
  const body = (item, i) => (
    <Field f={f.item} value={item} onChange={(v) => onChange(list.map((x, j) => (j === i ? v : x)))} s={s} top />
  );

  return (
    <fieldset className={s.group}>
      <legend className={s.legend}>{f.label}</legend>
      <ol className={s.listEdit}>
        {list.map((item, i) => (
          f.inline ? (
            <li key={item.id || i} className={s.listInline}>{body(item, i)}{tools(i)}</li>
          ) : f.collapsible ? (
            <li key={item.id || i}>
              <details className={s.listItem} open={item.id === fresh}>
                <summary className={s.listHead}><b>{item[f.titleKey] || `Új ${f.itemLabel}`}</b>{tools(i)}</summary>
                {body(item, i)}
              </details>
            </li>
          ) : (
            <li key={item.id || i} className={s.listItem}>
              <div className={s.listHead}><b>{item[f.titleKey] || `Új ${f.itemLabel}`}</b>{tools(i)}</div>
              {body(item, i)}
            </li>
          )
        ))}
      </ol>
      {list.length < f.max && <button type="button" className={s.small} onClick={add}>+ Új {f.itemLabel}</button>}
    </fieldset>
  );
}
