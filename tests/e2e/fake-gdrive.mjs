// Hamis Google (OAuth + Drive) szerver az e2e tesztekhez: a tesztszerver GOOGLE_DRIVE_TEST_BASE-szel ide küldi a
// kéréseket. Mappát hoz létre, multipart feltöltést fogad, és elteszi a fájlokat (név, mappa, tartalom).
// mode: 'ok' | 'fail-upload' (500) | 'bad-token' (invalid_grant) | 'lost-folder' (az első feltöltés 404)
import http from 'node:http';

export const GDRIVE_PORT = 25872;

export async function startGdrive(port = GDRIVE_PORT) {
  const state = { mode: 'ok', folders: [], files: [], tokenCalls: 0 };
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const send = (status, json) => { res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(json)); };
      if (req.url === '/token') {
        state.tokenCalls++;
        return state.mode === 'bad-token' ? send(400, { error: 'invalid_grant' }) : send(200, { access_token: 'hamis-token', expires_in: 3600 });
      }
      if (req.headers.authorization !== 'Bearer hamis-token') return send(401, { error: { message: 'no auth' } });
      if (req.url.startsWith('/drive/v3/files')) {
        const meta = JSON.parse(body || '{}');
        const id = `mappa${state.folders.length + 1}`;
        state.folders.push({ id, ...meta });
        return send(200, { id });
      }
      if (req.url.startsWith('/upload/drive/v3/files')) {
        if (state.mode === 'fail-upload') return send(500, { error: { message: 'szerverhiba' } });
        const boundary = /boundary=([^;]+)/.exec(req.headers['content-type'] || '')?.[1];
        const parts = body.split(`--${boundary}`).slice(1, -1).map(p => p.slice(p.indexOf('\r\n\r\n') + 4).replace(/\r\n$/, ''));
        const meta = JSON.parse(parts[0]);
        if (state.mode === 'lost-folder') { state.mode = 'ok'; return send(404, { error: { message: 'File not found' } }); }
        if (!state.folders.some(f => f.id === meta.parents?.[0])) return send(404, { error: { message: 'File not found' } });
        const id = `fajl${state.files.length + 1}`;
        state.files.push({ id, name: meta.name, parent: meta.parents?.[0], content: JSON.parse(parts[1]) });
        return send(200, { id, name: meta.name, webViewLink: `https://drive.google.com/file/d/${id}/view` });
      }
      send(404, { error: { message: 'ismeretlen' } });
    });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { state, close: () => new Promise(r => server.close(r)) };
}
