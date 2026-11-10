"use client";
import { createContext, useActionState, useContext, useEffect, useRef, useState } from 'react';
import { tabByKey, emptyValue } from '@/weblap/lib/contentSchema';
import { withBase } from '@/weblap/lib/basePath';
import { saveContentAction, uploadImageAction } from './actions';

// Az oldal tartalmának egy füle (a szerkesztőfelületen a Galéria és a Képfal). Az űrlapot a fül sémája rajzolja ki
// (weblap/lib/contentSchema.js); mentéskor a teljes fül JSON-ban megy a szervernek, ami a séma szerint ellenőrzi.
// s: az admin CSS-modulja; tabKey: a fül kulcsa; initial: a fül mostani tartalma; updated: { at, by } az utolsó mentésről
const PREVIEW_PATH = '/elonezet';
// A képfeltöltések száma: amíg fut, nem lehet menteni (különben a közben feltöltött kép elveszne)
const UploadCount = createContext(() => {});

export default function ContentEditor({ s, tabKey, initial, updated }) {
  const tab = tabByKey(tabKey);
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [last, setLast] = useState(updated);
  const [state, action, pending] = useActionState(saveContentAction, null);
  const [applied, setApplied] = useState(null);
  const [uploads, setUploads] = useState(0);

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
      <UploadCount.Provider value={(d) => setUploads(n => n + d)}>
        <Field f={tab.schema} value={value} onChange={setValue} s={s} top />
      </UploadCount.Provider>
      <div className={s.saveBar}>
        <button className={s.primary} disabled={pending || !dirty || uploads > 0}>{pending ? 'Mentés…' : 'Mentés az előnézetbe'}</button>
        <p className={s.saveStatus} role="status">
          {uploads > 0 ? <span className={s.muted}>Várj, amíg a képek feltöltődnek…</span>
            : state?.error && !pending
            ? <span className={s.error}>{state.error.split('\n').map((l, i) => <span key={i} className={s.errorLine}>{l}</span>)}</span>
            : dirty ? <span className={s.flag}>Nem mentett módosítások</span>
            : state?.ok ? <span className={s.ok}>Elmentve. Egyelőre csak az előnézetben látszik: <a href={withBase(PREVIEW_PATH)} target="_blank" rel="noopener">megnézem ↗</a></span>
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
      return f.photos ? <PhotoGrid f={f} value={value} onChange={onChange} s={s} /> : <ListField f={f} value={value} onChange={onChange} s={s} />;
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

const MAX_IMAGE = 4 * 1024 * 1024;
const rid = () => Math.random().toString(36).slice(2, 10);
const isHttp = (v) => { try { return ['http:', 'https:'].includes(new URL(v).protocol); } catch { return false; } };
const Icon = ({ d }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
const ICON = {
  left: 'M15 5l-7 7 7 7', right: 'M9 5l7 7-7 7',
  swap: 'M4 8h13l-3-3M20 16H7l3 3', trash: 'M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12',
  plus: 'M12 5v14M5 12h14',
};

// Képek rácsban (Galéria, Képfal): bélyegképek, egyszerre több kép feltöltése (vagy behúzása), kép linkje,
// sorrend, csere, törlés és felirat. A képre kattintva választható ki, hova essen a kép közepe.
function PhotoGrid({ f, value, onChange, s }) {
  const list = value || [];
  const hasCaption = !!f.item.fields.caption;
  const [jobs, setJobs] = useState([]); // feltöltések: { id, name, error }
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState(null);
  const [drag, setDrag] = useState(false);
  // a feltöltések egymás után futnak: mindig a legfrissebb listához és a legfrissebb onChange-hez írjanak
  // (különben a közben átírt cím vagy felirat visszaugrana)
  const latest = useRef(list);
  const change = useRef(onChange);
  useEffect(() => { latest.current = value || []; change.current = onChange; }, [value, onChange]);
  const counting = useContext(UploadCount);
  const room = f.max - list.length;

  const update = (next) => { latest.current = next; change.current(next); };
  const newItem = (src) => ({ ...emptyValue(f.item), id: `uj-${rid()}`, picture: { src, alt: '', position: '50% 50%' } });
  const setItem = (i, patch) => update(latest.current.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setPicture = (i, patch) => setItem(i, { picture: { ...latest.current[i].picture, ...patch } });
  const move = (i, d) => { const a = [...latest.current]; [a[i], a[i + d]] = [a[i + d], a[i]]; update(a); };
  const remove = (i) => { if (window.confirm('Biztosan törlöd ezt a képet?')) update(latest.current.filter((_, j) => j !== i)); };
  const job = (id, patch) => setJobs(js => (patch ? js.map(j => (j.id === id ? { ...j, ...patch } : j)) : js.filter(j => j.id !== id)));

  async function send(file) {
    if (!file.type?.startsWith('image/')) return { error: 'Ez nem kép.' };
    if (file.size > MAX_IMAGE) return { error: 'A kép legfeljebb 4 MB lehet.' };
    counting(1);
    try {
      const fd = new FormData();
      fd.append('file', file);
      return (await uploadImageAction(fd)) || { error: 'Nem sikerült feltölteni.' };
    } catch {
      return { error: 'Nem sikerült feltölteni. Próbáld újra.' };
    } finally {
      counting(-1);
    }
  }

  async function uploadMany(fileList) {
    const files = [...fileList];
    const take = files.slice(0, Math.max(0, f.max - latest.current.length));
    const skipped = files.length - take.length;
    const ids = take.map((file) => ({ id: rid(), name: file.name }));
    setJobs(js => [...js.filter(j => !j.error), ...ids, ...(skipped ? [{ id: 'tobb', name: `${skipped} kép`, error: `Nem fér el: legfeljebb ${f.max} kép lehet.` }] : [])]);
    for (const [i, file] of take.entries()) {
      const res = await send(file);
      if (res.url) { update([...latest.current, newItem(res.url)]); job(ids[i].id, null); }
      else job(ids[i].id, { error: res.error });
    }
  }

  // a cserélt képet az azonosítója szerint keresi meg (közben átrendezhették vagy törölhették)
  async function replace(i, file) {
    const id = rid();
    const itemId = latest.current[i].id;
    setJobs(js => [...js, { id, name: file.name }]);
    const res = await send(file);
    const at = latest.current.findIndex(x => x.id === itemId);
    if (res.url && at >= 0) { setPicture(at, { src: res.url }); job(id, null); }
    else job(id, { error: res.error || 'A képet közben törölték.' });
  }

  function addLink() {
    const v = link.trim();
    if (!isHttp(v)) { setLinkError('A link http:// vagy https:// kezdetű legyen.'); return; }
    if (room <= 0) { setLinkError(`Legfeljebb ${f.max} kép lehet.`); return; }
    update([...latest.current, newItem(v)]);
    setLink('');
    setLinkError(null);
  }

  function pick(e, i) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * 100);
    const y = Math.round(Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) * 100);
    setPicture(i, { position: `${x}% ${y}%` });
  }

  return (
    <fieldset className={s.group}>
      <legend className={s.legend}>{f.label} <span className={s.count}>{list.length} / {f.max}</span></legend>
      {list.length === 0 && <p className={s.muted}>Még nincs kép. Tölts fel egyet, vagy jelölj ki többet egyszerre.</p>}
      <ol className={s.photos}>
        {list.map((item, i) => {
          const [px, py] = (item.picture.position || '50% 50%').split(' ');
          return (
            <li key={item.id || i} className={s.photo} data-photo>
              <div className={s.photoImg} onClick={(e) => pick(e, i)} title="Kattints oda, ahol a kép lényege van">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={withBase(item.picture.src)} alt="" style={{ objectPosition: item.picture.position }} referrerPolicy="no-referrer" />
                <i className={s.imageDot} style={{ left: px, top: py }} aria-hidden="true" />
                <span className={s.photoNo}>{i + 1}.</span>
              </div>
              <div className={s.photoBody}>
                {hasCaption
                  ? <input className={s.photoText} value={item.caption || ''} maxLength={f.item.fields.caption.max} placeholder="Felirat (nem kötelező)" aria-label={`Felirat (${i + 1}. kép)`} onChange={(e) => setItem(i, { caption: e.target.value })} />
                  : <input className={s.photoText} value={item.picture.alt || ''} maxLength={300} placeholder="Mi látható a képen?" aria-label={`Mi látható a képen? (${i + 1}. kép)`} onChange={(e) => setPicture(i, { alt: e.target.value })} />}
                <div className={s.photoTools}>
                  <button type="button" className={s.iconBtn} disabled={i === 0} onClick={() => move(i, -1)}><Icon d={ICON.left} /><span className={s.sr}>Előre</span></button>
                  <button type="button" className={s.iconBtn} disabled={i === list.length - 1} onClick={() => move(i, 1)}><Icon d={ICON.right} /><span className={s.sr}>Hátra</span></button>
                  <label className={s.iconBtn}>
                    <Icon d={ICON.swap} /><span className={s.sr}>Csere</span>
                    <input type="file" accept="image/*" className={s.sr} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) replace(i, file); }} />
                  </label>
                  <button type="button" className={`${s.iconBtn} ${s.danger}`} onClick={() => remove(i)}><Icon d={ICON.trash} /><span className={s.sr}>Törlés</span></button>
                </div>
              </div>
            </li>
          );
        })}
        {room > 0 && (
          <li className={`${s.photoAdd} ${drag ? s.photoAddOn : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); uploadMany(e.dataTransfer.files); }}>
            <label>
              <Icon d={ICON.plus} />
              <b>{list.length ? 'Képek hozzáadása' : 'Képek feltöltése'}</b>
              <small>Egyszerre többet is kijelölhetsz. Legfeljebb 4 MB / kép.</small>
              <input type="file" accept="image/*" multiple className={s.sr} onChange={(e) => { const files = e.target.files; uploadMany(files); e.target.value = ''; }} />
            </label>
          </li>
        )}
      </ol>
      {jobs.length > 0 && (
        <ul className={s.jobs} role="status">
          {jobs.map(j => (
            <li key={j.id} className={j.error ? s.jobError : undefined}>
              <b>{j.name}</b>: {j.error || 'feltöltés…'}
              {j.error && <button type="button" className={s.link} onClick={() => job(j.id, null)}>Rendben</button>}
            </li>
          ))}
        </ul>
      )}
      {room > 0 && (
        <div className={s.linkRow}>
          <input value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }} placeholder="…vagy kép linkje: https://" inputMode="url" aria-label="Kép linkje" />
          <button type="button" className={s.small} onClick={addLink}>Hozzáadás</button>
          {linkError && <small className={s.error}>{linkError}</small>}
        </div>
      )}
    </fieldset>
  );
}
