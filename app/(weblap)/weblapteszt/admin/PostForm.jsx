"use client";
import { useActionState, useState } from 'react';
import { savePostAction } from './actions';
import { compressImage } from '@/weblap/lib/compressImage';
import { withBase } from '@/weblap/lib/basePath';

// Új hír, vagy egy meglévő szerkesztése (post: { id, title, text, link, image, date, published, pinned })
export default function PostForm({ s, post, nowLocal }) {
  const [state, action, pending] = useActionState(savePostAction, null);
  const v = state?.values || {};
  const pick = (k, fallback) => (k in v ? v[k] : fallback);
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState('');
  const [prep, setPrep] = useState(null); // { busy } | { error } – a kiválasztott kép tömörítése
  // A kiválasztott képet a böngésző tömöríti (iPhone-fotó, HEIC is), és a tömörített kerül az űrlapba
  async function pickImage(input) {
    const f = input.files?.[0];
    setPreview(null);
    setFileName(f?.name || '');
    if (!f) { setPrep(null); return; }
    setPrep({ busy: true });
    try {
      const small = await compressImage(f);
      if (small !== f) { const dt = new DataTransfer(); dt.items.add(small); input.files = dt.files; }
      setPreview(URL.createObjectURL(small));
      setPrep(null);
    } catch (err) {
      input.value = '';
      setFileName('');
      setPrep({ error: err.message || 'Ezt a képet nem tudtuk megnyitni.' });
    }
  }
  const editing = !!post?.id;
  return (
    <form action={action} className={s.form} key={post?.id || 'new'}>
      {editing && <input type="hidden" name="id" value={post.id} />}
      <label className={s.field}>
        <span>Cím</span>
        <input name="title" required maxLength={140} defaultValue={pick('title', post?.title || '')} />
      </label>
      <label className={s.field}>
        <span>Szöveg</span>
        <textarea name="text" rows={9} maxLength={10000} defaultValue={pick('text', post?.text || '')} />
        <small>Üres sor: új bekezdés. A főoldalon az eleje látszik, a teljes szöveg a hír saját oldalán.</small>
      </label>
      <div className={s.row}>
        <div className={s.field}>
          <span>Kép feltöltése</span>
          <label className={s.small}>
            {prep?.busy ? 'Kép előkészítése…' : fileName || 'Kép kiválasztása'}
            <input name="imageFile" type="file" accept="image/*" className={s.sr} onChange={(e) => pickImage(e.target)} />
          </label>
          {prep?.error ? <small className={s.error} role="alert">{prep.error}</small> : <small>A fotót (iPhone-ról is) magától tömöríti.</small>}
        </div>
        <label className={s.field}>
          <span>…vagy kép URL-je</span>
          <input name="imageUrl" type="url" placeholder="https://" defaultValue={pick('imageUrl', post?.image || '')} />
        </label>
      </div>
      {(preview || post?.image) && (
        <div className={s.preview}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview || post.image} alt="" />
          {editing && post.image && !preview && <label className={s.check}><input type="checkbox" name="removeImage" /> Kép eltávolítása</label>}
        </div>
      )}
      <div className={s.row}>
        <label className={s.field}>
          <span>Link (nem kötelező)</span>
          <input name="link" type="url" placeholder="https://" defaultValue={pick('link', post?.link || '')} />
          <small>Pl. az esemény a naptárban. A hír oldalán „Részletek” gomb lesz belőle.</small>
        </label>
        <label className={s.field}>
          <span>Dátum</span>
          <input name="date" type="datetime-local" defaultValue={pick('date', post?.date || nowLocal)} />
          <small>Ez szerint áll sorba a hírek között.</small>
        </label>
      </div>
      <div className={s.checks}>
        <label className={s.check}><input type="checkbox" name="published" defaultChecked={pick('published', post ? post.published : true)} /> Megjelenik az oldalon (ha kikapcsolod, félreteszi: nem látszik)</label>
        <label className={s.check}><input type="checkbox" name="pinned" defaultChecked={pick('pinned', post?.pinned || false)} /> Kiemelt (a hírek elejére kerül)</label>
      </div>
      {state?.error && <p className={s.error} role="alert">{state.error}</p>}
      <div className={s.actions}>
        <button className={s.primary} disabled={pending || prep?.busy}>{pending ? 'Mentés…' : prep?.busy ? 'Kép előkészítése…' : editing ? 'Mentés az előnézetbe' : 'Hír mentése az előnézetbe'}</button>
        {editing && <a className={s.secondary} href={withBase('/admin')}>Mégse</a>}
      </div>
    </form>
  );
}
