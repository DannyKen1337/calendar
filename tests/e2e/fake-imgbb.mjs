// Tesztszerverhez: az ImgBB-feltöltés 1,5 mp után sikeres ál-választ ad (a termékkód változatlan).
const real = globalThis.fetch;
let n = 0;
globalThis.fetch = async (url, opts) => {
  if (String(url).startsWith('https://api.imgbb.com/')) {
    await new Promise(r => setTimeout(r, 1500));
    n++;
    return new Response(JSON.stringify({ success: true, data: { url: `https://i.ibb.co/fake/${Date.now()}-${n}.jpg` } }), { headers: { 'content-type': 'application/json' } });
  }
  return real(url, opts);
};
