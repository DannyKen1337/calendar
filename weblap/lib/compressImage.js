// Képek tömörítése feltöltés előtt, a böngészőben (a szerkesztőfelület minden képfeltöltése ezt használja).
// Az iPhone-fotók (4–12 MB, akár 48 MP, HEIC vagy JPEG) is felmennek: a hosszabbik oldal legfeljebb 2560 px, jó minőségű
// JPEG (0,86), így az oldalon a nagyítóban is éles marad. Csak akkor enged a minőségből / méretből, ha még mindig túl nagy.
// A kép a fotó elforgatása (EXIF) szerint áll. Az átlátszó PNG / WebP (pl. a cégér) változatlan marad, ha belefér.
// Dekódolás tartalékokkal: createImageBitmap (elforgatással) → createImageBitmap → <img> (a Safari a HEIC-et is így olvassa)
// → HEIC esetén a heic2any (csak ilyenkor töltődik be). A RAW (DNG, pl. iPhone ProRAW) fotókból a beágyazott JPEG-előnézet
// megy fel (weblap/lib/dngPreview.js), a fejléc szerinti elforgatással.
import { isDng, dngPreview } from '@/weblap/lib/dngPreview';

export const MAX_UPLOAD = 4 * 1024 * 1024; // a szerver (ImgBB-feltöltés) felső határa
const TARGET = 3.5 * 1024 * 1024;
const MAX_SIDE = 2560;

const isHeic = (file) => /hei[cf]/i.test(file.type || '') || /\.hei[cf]$/i.test(file.name || '');
const baseName = (name) => String(name || 'kep').replace(/\.[^.]+$/, '') || 'kep';

async function viaImg(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

async function decode(blob) {
  if (typeof createImageBitmap === 'function') {
    for (const opts of [{ imageOrientation: 'from-image' }, undefined]) {
      try {
        const bmp = await (opts ? createImageBitmap(blob, opts) : createImageBitmap(blob));
        return { source: bmp, width: bmp.width, height: bmp.height, done: () => bmp.close?.() };
      } catch { /* következő módszer */ }
    }
  }
  return viaImg(blob);
}

// DNG: a beágyazott előnézet dekódolva, elforgatás nélkül (azt a DNG fejléce mondja meg, a rajzolásnál alkalmazzuk)
async function decodeDng(file) {
  if (file.size > 200 * 1024 * 1024) throw new Error('Ez a RAW-kép túl nagy.');
  const buf = await file.arrayBuffer();
  const prev = dngPreview(buf);
  if (!prev) throw new Error('Ebből a RAW (DNG) képből nem tudtunk képet kinyerni. Exportáld JPG-ként.');
  const blob = new Blob([buf.slice(prev.start, prev.end)], { type: 'image/jpeg' });
  let img;
  try {
    const bmp = await createImageBitmap(blob, { imageOrientation: 'none' });
    img = { source: bmp, width: bmp.width, height: bmp.height, done: () => bmp.close?.() };
  } catch {
    img = await viaImg(blob);
  }
  return { ...img, orientation: prev.orientation };
}

const toBlob = (canvas, quality) => new Promise(r => canvas.toBlob(r, 'image/jpeg', quality));

// Visszaad: a feltölthető File (lehet maga az eredeti), vagy hibát dob érthető üzenettel
export async function compressImage(file) {
  const keepAsIs = ['image/gif', 'image/svg+xml'].includes(file.type) || (['image/png', 'image/webp'].includes(file.type) && file.size <= MAX_UPLOAD);
  if (keepAsIs) {
    if (file.size > MAX_UPLOAD) throw new Error('Ez a kép túl nagy (legfeljebb 4 MB lehet).');
    return file;
  }
  let img;
  if (isDng(file)) {
    img = await decodeDng(file).catch((err) => { throw new Error(err?.message?.includes('RAW') ? err.message : 'Ezt a RAW (DNG) képet nem tudtuk megnyitni. Exportáld JPG-ként.'); });
  } else try {
    img = await decode(file);
  } catch {
    if (!isHeic(file)) throw new Error('Ezt a képet nem tudtuk megnyitni. Próbáld JPG-ként.');
    try {
      const heic2any = (await import('heic2any')).default;
      const jpg = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
      img = await decode(Array.isArray(jpg) ? jpg[0] : jpg);
    } catch {
      throw new Error('Ezt a HEIC-képet nem tudtuk megnyitni. iPhone-on: Beállítások › Kamera › Formátumok › Legkompatibilisebb, vagy küldd el JPG-ként.');
    }
  }
  try {
    // Kicsi és már JPEG: nincs mit tenni
    if (file.type === 'image/jpeg' && file.size <= TARGET && Math.max(img.width, img.height) <= MAX_SIDE) return file;
    const turn = img.orientation === 6 || img.orientation === 8; // 90°-os elforgatásnál a szélesség és a magasság cserél
    let side = Math.min(MAX_SIDE, Math.max(img.width, img.height));
    for (let attempt = 0; attempt < 4; attempt++) {
      const scale = side / Math.max(img.width, img.height);
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = turn ? h : w;
      canvas.height = turn ? w : h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#ffffff'; // az átlátszó részek fehérek legyenek, ne feketék
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (img.orientation === 6) { ctx.translate(canvas.width, 0); ctx.rotate(Math.PI / 2); }
      else if (img.orientation === 8) { ctx.translate(0, canvas.height); ctx.rotate(-Math.PI / 2); }
      else if (img.orientation === 3) { ctx.translate(canvas.width, canvas.height); ctx.rotate(Math.PI); }
      ctx.drawImage(img.source, 0, 0, w, h);
      for (const q of [0.86, 0.78, 0.7]) {
        const blob = await toBlob(canvas, q);
        if (blob && blob.size <= TARGET) return new File([blob], `${baseName(file.name)}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified });
      }
      side = Math.round(side * 0.8);
    }
    throw new Error('Ezt a képet nem sikerült elég kicsire tömöríteni.');
  } finally {
    img.done();
  }
}
