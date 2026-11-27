#!/usr/bin/env node
// A Google Drive-mentés egyszeri beállítása: megnyitja a Google belépő oldalát, a tulajdonos engedélyezi, hogy a naptár
// a Drive-jára mentsen (csak a saját maga által létrehozott fájlokhoz fér hozzá: „drive.file” jog), és kiírja a
// GOOGLE_DRIVE_REFRESH_TOKEN értékét, amit a Vercelen kell beállítani. Leírás: docs/google-drive.md.
//
//   node scripts/google-drive-setup.mjs <CLIENT_ID> <CLIENT_SECRET>
//
// (Vagy a GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET környezeti változókkal.) Csak Node beépített moduljait használja.
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { exec } from 'node:child_process';

const clientId = process.argv[2] || process.env.GOOGLE_DRIVE_CLIENT_ID;
const clientSecret = process.argv[3] || process.env.GOOGLE_DRIVE_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error('Használat: node scripts/google-drive-setup.mjs <CLIENT_ID> <CLIENT_SECRET>\n(a Google Cloud Console › APIs & Services › Credentials oldaláról, „Desktop app” típusú OAuth-ügyfél)');
  process.exit(1);
}

const state = randomBytes(16).toString('hex');
const server = http.createServer();
server.listen(0, '127.0.0.1', () => {
  const redirectUri = `http://127.0.0.1:${server.address().port}/`;
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'https://www.googleapis.com/auth/drive.file',
    access_type: 'offline', prompt: 'consent', state,
  })}`;
  console.log('\nNyisd meg ezt a linket (ha nem nyílt meg magától), és lépj be azzal a Google-fiókkal, amelyiknek a Drive-jára menteni szeretnél:\n');
  console.log(url, '\n');
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start ""' : 'xdg-open';
  exec(`${opener} "${url}"`, () => {});

  server.on('request', async (req, res) => {
    const params = new URL(req.url, redirectUri).searchParams;
    if (!params.get('code') && !params.get('error')) { res.writeHead(404).end(); return; }
    const finish = (text) => { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }).end(text); server.close(); };
    if (params.get('state') !== state) return finish('Hibás válasz (state). Futtasd újra a szkriptet.');
    if (params.get('error')) { finish(`A Google elutasította: ${params.get('error')}`); console.error('Elutasítva:', params.get('error')); process.exitCode = 1; return; }
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code: params.get('code'), client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
      });
      const json = await tokenRes.json();
      if (!json.refresh_token) throw new Error(json.error_description || json.error || 'nem jött refresh token');
      finish('Kész! Visszatérhetsz a terminálhoz.');
      console.log('Kész! Állítsd be a Vercelen (Settings › Environment Variables, Production):\n');
      console.log(`GOOGLE_DRIVE_CLIENT_ID=${clientId}`);
      console.log('GOOGLE_DRIVE_CLIENT_SECRET=(az ügyfél titka, amit most is megadtál)');
      console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${json.refresh_token}\n`);
      console.log('Ezt a kulcsot ne küldd el senkinek, és ne tedd ki nyilvános helyre: ezzel a naptár a Drive-odra menthet.');
    } catch (err) {
      finish(`Nem sikerült: ${err.message}`);
      console.error('Nem sikerült:', err.message);
      process.exitCode = 1;
    }
  });
});
