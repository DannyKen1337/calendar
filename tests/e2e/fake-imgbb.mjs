// Tesztszerverhez: az ImgBB-feltöltés 1,5 mp után sikeres ál-választ ad (a termékkód változatlan); a cím végén a kapott
// kép mérete bájtban.
const real = globalThis.fetch;
let n = 0;
globalThis.fetch = async (url, opts) => {
  if (String(url).startsWith('https://api.imgbb.com/')) {
    await new Promise(r => setTimeout(r, 1500));
    n++;
    // a kapott kép mérete és típusa a címben (a tömörítés tesztjéhez): .../<idő>-<sorszám>-<bájt>.<jpg|png>
    const img = opts?.body?.get?.('image');
    const size = img?.size || 0;
    const ext = img?.type === 'image/png' ? 'png' : 'jpg';
    return new Response(JSON.stringify({ success: true, data: { url: `https://i.ibb.co/fake/${Date.now()}-${n}-${size}.${ext}` } }), { headers: { 'content-type': 'application/json' } });
  }
  return real(url, opts);
};
