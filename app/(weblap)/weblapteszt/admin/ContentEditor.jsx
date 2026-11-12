"use client";
import { createContext, useActionState, useContext, useEffect, useRef, useState } from 'react';
import { tabByKey, emptyValue, ALBUM_MAX_PICTURES } from '@/weblap/lib/contentSchema';
import { albumsFromFiles, findAlbum, isImageFile } from '@/weblap/lib/albums';
import { withBase } from '@/weblap/lib/basePath';
import { saveContentAction, uploadImageAction, driveListAction, driveImportAction } from './actions';

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
    case 'date':
      return (
        <label className={s.field}>
          <span>{f.label}</span>
          <input type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
          {f.help && <small>{f.help}</small>}
        </label>
      );
    case 'select':
      return (
        <label className={s.field}>
          <span>{f.label}</span>
          <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
            {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
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
    setBusy(true);
    setError(null);
    try {
      const res = await uploadOne(file);
      if (res?.url) set({ src: res.url, ...(res.thumb ? { thumb: res.thumb } : {}) });
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
          <input value={v.src} onChange={(e) => set({ src: e.target.value, thumb: undefined })} placeholder="https://…" aria-label={`${f.label}: a kép címe`} />
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
      {f.folders && <FolderUpload f={f} list={list} onChange={onChange} s={s} />}
      <ol className={s.listEdit}>
        {list.map((item, i) => (
          f.inline ? (
            <li key={item.id || i} className={s.listInline}>{body(item, i)}{tools(i)}</li>
          ) : f.collapsible ? (
            <li key={item.id || i}>
              <details className={s.listItem} open={item.id === fresh}>
                <summary className={s.listHead}><b>{item[f.titleKey] || `Új ${f.itemLabel}`}{f.folders && <small className={s.muted}> · {[item.date, `${item.pictures?.length || 0} kép`].filter(Boolean).join(' · ')}</small>}</b>{tools(i)}</summary>
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

// Feltöltés előtt a nagy fotót kicsinyíti (a hosszabbik oldala legfeljebb 2000 px, JPEG): a telefonok 5–10 MB-os képei
// is gyorsan felmennek, és a Galéria is gyorsabban töltődik. A PNG / WebP (pl. átlátszó cégér) 4 MB-ig marad, ahogy van.
async function shrink(file) {
  const keep = ['image/gif', 'image/svg+xml'].includes(file.type) || (['image/png', 'image/webp'].includes(file.type) && file.size <= MAX_IMAGE);
  if (keep || typeof createImageBitmap !== 'function') return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size <= 1.5 * 1024 * 1024 && file.type === 'image/jpeg') { bmp.close?.(); return file; }
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close?.();
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
    return blob ? new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

// Egy kép feltöltése (kicsinyítve). Visszaad: { url, thumb? } vagy { error }
async function uploadOne(file) {
  if (!isImageFile(file)) return { error: 'Ez nem kép.' };
  const ready = await shrink(file);
  if (/hei[cf]/i.test(ready.type) || /\.hei[cf]$/i.test(ready.name)) return { error: 'HEIC-képet a böngészők nem tudnak megjeleníteni. Mentsd el JPG-ként (iPhone: Beállítások › Kamera › Formátumok › Legkompatibilisebb).' };
  if (ready.size > MAX_IMAGE) return { error: 'A kép legfeljebb 4 MB lehet.' };
  try {
    const fd = new FormData();
    fd.append('file', ready);
    return (await uploadImageAction(fd)) || { error: 'Nem sikerült feltölteni.' };
  } catch {
    return { error: 'Nem sikerült feltölteni. Próbáld újra.' };
  }
}

// A behúzott mappák fájljai (a mappán belüli úttal), a böngésző fájlrendszer-bejegyzéseiből
async function droppedFiles(items) {
  const out = [];
  const walk = async (entry, path) => {
    if (entry.isFile) {
      const file = await new Promise((res, rej) => entry.file(res, rej)).catch(() => null);
      if (file) out.push({ file, path: `${path}${file.name}` });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      // a readEntries egyszerre csak egy adagot ad: addig kérünk, amíg üreset nem kapunk
      for (;;) {
        const batch = await new Promise((res, rej) => reader.readEntries(res, rej)).catch(() => []);
        if (!batch.length) break;
        for (const e of batch) await walk(e, `${path}${entry.name}/`);
      }
    }
  };
  const entries = [...items].map(it => it.webkitGetAsEntry?.()).filter(Boolean);
  for (const e of entries) await walk(e, '');
  return out;
}

// Mappa feltöltése az Albumokhoz: minden képet tartalmazó mappából egy album (a mappa nevével, a névből kitalált
// dátummal és játékkal; a már meglévő, azonos nevű és dátumú albumba kerül). A képek háromszálon mennek fel, de
// eredeti (fájlnév szerinti) sorrendben kerülnek az albumba.
function FolderUpload({ f, list, onChange, s }) {
  const latest = useRef(list);
  const change = useRef(onChange);
  useEffect(() => { latest.current = list; change.current = onChange; }, [list, onChange]);
  const counting = useContext(UploadCount);
  const [run, setRun] = useState(null); // { done, total, title, errors, finished }
  const [drag, setDrag] = useState(false);
  const [drive, setDrive] = useState('');
  const [driveState, setDriveState] = useState(null); // { loading } | { error }
  const update = (next) => { latest.current = next; change.current(next); };
  const busy = run && !run.finished;

  async function fromDrive() {
    if (busy || driveState?.loading || !drive.trim()) return;
    setDriveState({ loading: true });
    const res = await driveListAction(drive).catch(() => ({ error: 'Nem sikerült megnyitni a mappát. Próbáld újra.' }));
    if (res?.error) { setDriveState({ error: res.error }); return; }
    setDriveState(null);
    setDrive('');
    start(res.files.map(d => ({ drive: d })));
  }

  // entries: gépről [{ file, path }], Google Drive-ról [{ drive: { id, name, type, path, lastModified } }]
  async function start(entries) {
    const files = entries.map(({ file, path, drive }) => (drive
      ? { ...drive, driveId: drive.id }
      : { name: file.name, type: file.type, path: path || file.webkitRelativePath || file.name, lastModified: file.lastModified, file }));
    const groups = albumsFromFiles(files);
    if (!groups.length) { setRun({ done: 0, total: 0, errors: ['Nincs kép a kiválasztott mappában.'], finished: true }); return; }
    const total = groups.reduce((n, g) => n + g.files.length, 0);
    const errors = [];
    let done = 0;
    setRun({ done, total, title: groups[0].title, errors, finished: false });
    for (const g of groups) {
      let id;
      const at = findAlbum(latest.current, g);
      if (at >= 0) id = latest.current[at].id;
      else if (latest.current.length >= f.max) {
        errors.push(`${g.title}: nem fér el több album (legfeljebb ${f.max}).`);
        done += g.files.length;
        setRun(r => ({ ...r, done, errors: [...errors] }));
        continue;
      } else {
        id = `uj-${rid()}`;
        update([{ ...emptyValue(f.item), id, title: g.title, date: g.date, game: g.game }, ...latest.current]);
      }
      setRun(r => ({ ...r, title: g.title }));
      const results = new Array(g.files.length);
      let flushed = 0;
      let next = 0;
      const flush = () => {
        const ready = [];
        while (flushed < results.length && results[flushed]) { const r = results[flushed++]; if (r.url) ready.push(r); }
        if (!ready.length) return;
        update(latest.current.map(a => {
          if (a.id !== id) return a;
          const room = ALBUM_MAX_PICTURES - (a.pictures?.length || 0);
          if (room < ready.length) errors.push(`${g.title}: ${ready.length - Math.max(0, room)} kép nem fér el (egy albumban legfeljebb ${ALBUM_MAX_PICTURES}).`);
          const add = ready.slice(0, Math.max(0, room)).map(r => ({ id: `uj-${rid()}`, caption: '', picture: { src: r.url, ...(r.thumb ? { thumb: r.thumb } : {}), alt: '', position: '50% 50%' } }));
          return { ...a, pictures: [...(a.pictures || []), ...add] };
        }));
      };
      const worker = async () => {
        while (next < g.files.length) {
          const i = next++;
          counting(1);
          const item = g.files[i];
          const res = await (item.driveId ? driveImportAction(item.driveId).catch(() => ({ error: 'Nem sikerült átmásolni.' })) : uploadOne(item.file)).finally(() => counting(-1));
          if (res.error) errors.push(`${g.files[i].name}: ${res.error}`);
          results[i] = res;
          done++;
          flush();
          setRun(r => ({ ...r, done, errors: [...errors] }));
        }
      };
      await Promise.all([worker(), worker(), worker()]);
    }
    setRun(r => ({ ...r, done, errors: [...errors], finished: true }));
  }

  return (
    <div className={`${s.folder} ${drag ? s.photoAddOn : ''}`} data-mappa
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={async (e) => { e.preventDefault(); setDrag(false); if (!busy) start(await droppedFiles(e.dataTransfer.items)); }}>
      <label className={s.small} aria-disabled={busy || undefined}>
        {busy ? 'Feltöltés folyamatban…' : 'Mappa feltöltése'}
        <input type="file" multiple webkitdirectory="" directory="" className={s.sr} disabled={busy}
          onChange={(e) => { const files = [...(e.target.files || [])].map(file => ({ file, path: file.webkitRelativePath })); e.target.value = ''; start(files); }} />
      </label>
      <small className={s.muted}>Válassz ki (vagy húzz ide) egy mappát. Minden mappából egy album lesz, pl. „Pokeween 2026-10-31”. Telefonon az albumot a „+ Új album” gombbal hozd létre, és abba töltsd fel a képeket.</small>
      {/* (a szerkesztő maga is űrlap, ezért itt nincs külön form: gomb és Enter) */}
      <div className={s.drive} data-drive>
        <label htmlFor="drive-link"><b>…vagy Google Drive-ból:</b> másold be a mappa linkjét (Megosztás › „Bárki, aki rendelkezik a linkkel”)</label>
        <span className={s.driveRow}>
          <input id="drive-link" value={drive} onChange={(e) => { setDrive(e.target.value); setDriveState(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); fromDrive(); } }} placeholder="https://drive.google.com/drive/folders/…" inputMode="url" disabled={busy} aria-describedby={driveState?.error ? 'drive-hiba' : undefined} aria-invalid={driveState?.error ? true : undefined} />
          <button type="button" className={s.small} onClick={fromDrive} disabled={busy || driveState?.loading || !drive.trim()}>{driveState?.loading ? 'Megnyitás…' : 'Behúzás'}</button>
        </span>
        {driveState?.error && <small id="drive-hiba" className={s.error}>{driveState.error}</small>}
      </div>
      {run && (
        <div className={s.folderRun} role="status">
          {run.total > 0 && (
            <>
              <b>{run.finished ? `Kész: ${run.done} / ${run.total} kép` : `Feltöltés: ${run.done} / ${run.total} kép (${run.title})`}</b>
              <span className={s.folderBar} aria-hidden="true"><span style={{ width: `${(run.done / run.total) * 100}%` }} /></span>
            </>
          )}
          {run.errors.length > 0 && <ul className={s.jobs}>{run.errors.slice(0, 8).map((e, i) => <li key={i} className={s.jobError}>{e}</li>)}{run.errors.length > 8 && <li className={s.jobError}>…és még {run.errors.length - 8} hiba</li>}</ul>}
          {run.finished && <small className={s.muted}>Ne felejtsd el: a „Mentés az előnézetbe” gombbal mentsd el.</small>}
        </div>
      )}
    </div>
  );
}
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
  const newItem = (src, thumb) => ({ ...emptyValue(f.item), id: `uj-${rid()}`, picture: { src, ...(thumb ? { thumb } : {}), alt: '', position: '50% 50%' } });
  const setItem = (i, patch) => update(latest.current.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setPicture = (i, patch) => setItem(i, { picture: { ...latest.current[i].picture, ...patch } });
  const move = (i, d) => { const a = [...latest.current]; [a[i], a[i + d]] = [a[i + d], a[i]]; update(a); };
  const remove = (i) => { if (window.confirm('Biztosan törlöd ezt a képet?')) update(latest.current.filter((_, j) => j !== i)); };
  const job = (id, patch) => setJobs(js => (patch ? js.map(j => (j.id === id ? { ...j, ...patch } : j)) : js.filter(j => j.id !== id)));

  async function send(file) {
    counting(1);
    try {
      return await uploadOne(file);
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
    // Közben egy másik csomag is futhat: minden kép előtt és után újra megnézzük, fér-e még
    const full = () => latest.current.length >= f.max;
    const noRoom = { error: `Nem fér el: legfeljebb ${f.max} kép lehet.` };
    for (const [i, file] of take.entries()) {
      if (full()) { job(ids[i].id, noRoom); continue; }
      const res = await send(file);
      if (res.url && full()) job(ids[i].id, noRoom);
      else if (res.url) { update([...latest.current, newItem(res.url, res.thumb)]); job(ids[i].id, null); }
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
    if (res.url && at >= 0) { setPicture(at, { src: res.url, thumb: res.thumb }); job(id, null); }
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
                <img src={withBase(item.picture.thumb || item.picture.src)} alt="" loading="lazy" style={{ objectPosition: item.picture.position }} referrerPolicy="no-referrer" />
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
              <small>Egyszerre többet is kijelölhetsz. A nagy fotókat feltöltés előtt kicsinyíti.</small>
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
