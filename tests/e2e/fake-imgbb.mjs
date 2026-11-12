// Tesztszerverhez: az ImgBB-feltöltés 1,5 mp után sikeres ál-választ ad (a termékkód változatlan).
// Az ál-Google Drive: „Tavern fotók” mappa (driveGyoker123) egy „Pokémon Prerelease 2026-11-15” almappával (2 kép) és
// egy nem kép fájllal; a „privatmappa000” nem megosztott (404).
const real = globalThis.fetch;
let n = 0;
globalThis.fetch = async (url, opts) => {
  if (String(url).startsWith('https://api.imgbb.com/')) {
    await new Promise(r => setTimeout(r, 1500));
    n++;
    return new Response(JSON.stringify({ success: true, data: { url: `https://i.ibb.co/fake/${Date.now()}-${n}.jpg` } }), { headers: { 'content-type': 'application/json' } });
  }
  if (String(url).startsWith('https://www.googleapis.com/drive/v3/files')) return fakeDrive(new URL(url));
  return real(url, opts);
};

const FOLDER = 'application/vnd.google-apps.folder';
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
const DRIVE = {
  driveGyoker123: { id: 'driveGyoker123', name: 'Tavern fotók', mimeType: FOLDER, children: ['driveAlmappa456', 'driveLeiras0001'] },
  driveAlmappa456: { id: 'driveAlmappa456', name: 'Pokémon Prerelease 2026-11-15', mimeType: FOLDER, children: ['driveKep0000002', 'driveKep0000001'] },
  driveLeiras0001: { id: 'driveLeiras0001', name: 'leírás.pdf', mimeType: 'application/pdf' },
  driveKep0000001: { id: 'driveKep0000001', name: 'kep1.png', mimeType: 'image/png', size: String(PNG.length), imageMediaMetadata: { time: '2026:11:15 18:00:00' } },
  driveKep0000002: { id: 'driveKep0000002', name: 'kep2.png', mimeType: 'image/png', size: String(PNG.length) },
};
const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json' } });
function fakeDrive(u) {
  if (u.searchParams.get('key') !== 'fake') return json({ error: 'kulcs' }, 400);
  const id = u.pathname.split('/files/')[1];
  if (id) {
    const f = DRIVE[decodeURIComponent(id)];
    if (!f) return json({ error: { code: 404 } }, 404);
    if (u.searchParams.get('alt') === 'media') return new Response(PNG, { headers: { 'content-type': f.mimeType } });
    const { children, ...meta } = f;
    return json(meta);
  }
  const parent = (u.searchParams.get('q') || '').match(/'([\w-]+)' in parents/)?.[1];
  const list = (DRIVE[parent]?.children || []).map(c => { const { children, ...meta } = DRIVE[c]; return meta; });
  return json({ files: list.sort((a, b) => a.name.localeCompare(b.name)) });
}
