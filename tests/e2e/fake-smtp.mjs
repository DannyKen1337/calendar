// Hamis SMTP-szerver az e2e tesztekhez: a tesztszerver (SMTP_HOST=127.0.0.1, SMTP_INSECURE_TEST=1) ide küldi a leveleket,
// a teszt pedig a mailparserrel olvassa vissza őket (címzett, válaszcím, tárgy, szöveg).
import net from 'node:net';
import { simpleParser } from 'mailparser';

export const SMTP_PORT = 25871;

export async function startSmtp(port = SMTP_PORT) {
  const raw = [];
  const server = net.createServer((sock) => {
    let data = false; let buf = ''; let body = ''; let rcpt = [];
    const say = (l) => sock.write(`${l}\r\n`);
    say('220 teszt ESMTP');
    sock.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (data) {
          if (line === '.') { data = false; raw.push({ rcpt, body }); body = ''; rcpt = []; say('250 OK'); } else body += `${line.startsWith('..') ? line.slice(1) : line}\r\n`;
          continue;
        }
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === 'EHLO') sock.write('250-teszt\r\n250 AUTH PLAIN LOGIN\r\n');
        else if (cmd === 'AUTH') say('235 OK');
        else if (cmd === 'RCPT') { rcpt.push(line.replace(/^RCPT TO:\s*<?|>.*$/gi, '')); say('250 OK'); }
        else if (cmd === 'DATA') { data = true; say('354 Mehet'); }
        else if (cmd === 'QUIT') { say('221 Viszlát'); sock.end(); }
        else say('250 OK');
      }
    });
    sock.on('error', () => {});
  });
  await new Promise((res, rej) => { server.once('error', rej); server.listen(port, '127.0.0.1', res); });
  return {
    // A beérkezett levelek feldolgozva: { to, replyTo, subject, html, text }
    mails: () => Promise.all(raw.map(async ({ rcpt, body }) => {
      const m = await simpleParser(body);
      return { to: rcpt, replyTo: m.replyTo?.value?.map(v => v.address) || [], subject: m.subject || '', html: m.html || '', text: m.text || '' };
    })),
    close: () => new Promise(res => server.close(res)),
  };
}
