// Tesztszerverhez: az ImgBB-feltöltés 1,5 mp után sikeres ál-választ ad (a termékkód változatlan). A kapott kép adatai a
// címben: .../<idő>-<sorszám>-<szélesség>x<magasság>-<bájt>.<jpg|png> (a tömörítés és a képszerkesztés tesztjéhez).
// Az ál-képek (https://i.ibb.co/fake/...) letöltésekor egy 300 × 200-as JPEG jön (bal fele piros, jobb fele kék).
import sharp from 'sharp';

const real = globalThis.fetch;
let n = 0;
let sample = null;
const sampleJpeg = async () => {
  if (!sample) {
    const left = await sharp({ create: { width: 150, height: 200, channels: 3, background: '#ff0000' } }).png().toBuffer();
    sample = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#0000ff' } }).composite([{ input: left, left: 0, top: 0 }]).jpeg().toBuffer();
  }
  return sample;
};

globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.startsWith('https://api.imgbb.com/')) {
    await new Promise(r => setTimeout(r, 1500));
    n++;
    const img = opts?.body?.get?.('image');
    const size = img?.size || 0;
    const ext = img?.type === 'image/png' ? 'png' : 'jpg';
    let dims = '0x0';
    try { const m = await sharp(Buffer.from(await img.arrayBuffer())).metadata(); dims = `${m.width}x${m.height}`; } catch { /* nem kép */ }
    return new Response(JSON.stringify({ success: true, data: { url: `https://i.ibb.co/fake/${Date.now()}-${n}-${dims}-${size}.${ext}` } }), { headers: { 'content-type': 'application/json' } });
  }
  if (u.startsWith('https://i.ibb.co/fake/')) return new Response(await sampleJpeg(), { headers: { 'content-type': 'image/jpeg' } });
  return real(url, opts);
};
