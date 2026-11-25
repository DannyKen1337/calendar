// SMTP-s küldés (átmeneti megoldás a Resend előtt): egy kis helyi, hamis SMTP-szerver fogadja a levelet, és ellenőrizzük,
// hogy kiment-e, jó-e a feladó, a címzett, a tárgy és a válaszcím; hibás jelszónál érthető hibát ad.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';

const received = [];
let server;
let port;

// Minimális SMTP-szerver: EHLO, AUTH PLAIN/LOGIN, MAIL, RCPT, DATA. A "rossz" jelszót elutasítja.
before(async () => {
  server = net.createServer((sock) => {
    let data = false; let buf = ''; let mail = { rcpt: [] }; let authStep = 0;
    const say = (l) => sock.write(`${l}\r\n`);
    say('220 teszt ESMTP');
    sock.on('data', (chunk) => {
      buf += chunk.toString();
      let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (data) {
          if (line === '.') { data = false; received.push(mail); mail = { rcpt: [] }; say('250 OK'); } else mail.body = `${mail.body || ''}${line}\n`;
          continue;
        }
        if (authStep === 1) { authStep = 2; say('334 UGFzc3dvcmQ6'); continue; }
        if (authStep === 2) { authStep = 0; say(Buffer.from(line, 'base64').toString() === 'rossz' ? '535 Hibás jelszó' : '235 OK'); continue; }
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === 'EHLO') { sock.write('250-teszt\r\n250 AUTH PLAIN LOGIN\r\n'); }
        else if (cmd === 'AUTH') {
          if (/^AUTH PLAIN /i.test(line)) say(Buffer.from(line.slice(11), 'base64').toString().split('\0')[2] === 'rossz' ? '535 Hibás jelszó' : '235 OK');
          else { authStep = 1; say('334 VXNlcm5hbWU6'); }
        }
        else if (cmd === 'MAIL') { mail.from = line; say('250 OK'); }
        else if (cmd === 'RCPT') { mail.rcpt.push(line); say('250 OK'); }
        else if (cmd === 'DATA') { data = true; say('354 Mehet'); }
        else if (cmd === 'QUIT') { say('221 Viszlát'); sock.end(); }
        else say('250 OK');
      }
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
});
after(() => server.close());

const setEnv = (pass) => Object.assign(process.env, {
  SMTP_HOST: '127.0.0.1', SMTP_PORT: String(port), SMTP_USER: 'taverncalendar@gmail.com', SMTP_PASS: pass, SMTP_INSECURE_TEST: '1',
  RESEND_API_KEY: '', MAIL_FROM: '',
});

test('SMTP beállítva: a levél kimegy a postafiókból', async () => {
  setEnv('jo-jelszo');
  const { isMailConfigured, sendMail } = await import('./mailer.js');
  assert.equal(isMailConfigured(), true);
  await sendMail({ to: 'jatekos@example.com', subject: 'Sikeres jelentkezés', html: '<p>Szia!</p>', text: 'Szia!', replyTo: 'valasz@example.com' });
  assert.equal(received.length, 1);
  const m = received[0];
  assert.match(m.from, /taverncalendar@gmail\.com/);
  assert.match(m.rcpt[0], /jatekos@example\.com/);
  assert.match(m.body, /^From: =\?UTF-8\?Q\?Tavern_Napt=C3=A1r\?= <taverncalendar@gmail\.com>/m); // „Tavern Naptár” kódolva
  assert.match(m.body, /Reply-To: valasz@example\.com/i);
  assert.match(m.body, /^Subject: =\?UTF-8\?Q\?Sikeres_jelentkez=C3=A9s\?=/m);
});

test('hibás jelszó: érthető hiba, és utána újra próbálkozik', async () => {
  setEnv('rossz');
  const mod = await import(`./mailer.js?v=${Date.now()}`); // új példány, friss kapcsolattal
  await assert.rejects(() => mod.sendMail({ to: 'a@example.com', subject: 'x', html: 'x' }), /E-mail küldés sikertelen \((535|EAUTH)\)/);
  process.env.SMTP_PASS = 'jo-jelszo';
  await mod.sendMail({ to: 'b@example.com', subject: 'y', html: 'y' });
  assert.match(received.at(-1).rcpt[0], /b@example\.com/);
});

test('semmi nincs beállítva: nincs e-mail', async () => {
  Object.assign(process.env, { SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '', RESEND_API_KEY: '', MAIL_FROM: '' });
  const { isMailConfigured } = await import('./mailer.js');
  assert.equal(isMailConfigured(), false);
});
