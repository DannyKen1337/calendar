// Az e2e tesztek futtatója (npm run test:e2e): elindítja a tesztszervert, egymás után lefuttatja a teszteket, a végén leállít.
// Két kör: a szokásos (képfeltöltés kulcs nélkül), és egy ál-ImgBB-vel (sikeres feltöltések) a feltöltési versenyhelyzetekhez.
// Egy fájl: npm run test:e2e -- naptar-havi
// Előfeltétel: Google Chrome (CHROME_PATH-szal felülírható); a 3179-es port szabad; ne fusson közben másik `next dev` ebben a mappában.
import { spawn } from 'node:child_process';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const URL_ = 'http://localhost:3179/api/auth/session';
const TEST_TIMEOUT = 10 * 60 * 1000; // egy tesztfájl legfeljebb ennyi ideig fut
const ROUNDS = [
  { fake: false, tests: ['weblap-jog', 'weblap-ligak', 'weblap-elorendeles', 'weblap-asztalfoglalas', 'weblap-fooldal', 'weblap-mozgasok', 'weblap-kepbetoltes', 'weblap-felulet', 'naptar-havi', 'naptar-oldalak', 'naptar-esemeny', 'urlapok', 'admin', 'admin-kozossegi', 'admin-uzenetek', 'admin-levelek', 'admin-push', 'admin-jatekosok', 'checkin-pipa', 'telefon-ablakok', 'ligak-tobb', 'liga-riftbound', 'naptar-booster', 'esemeny-kep', 'elorendeles-boltok', 'admin-udvozlo', 'email-ellenorzes', 'regi-cimek', 'biztonsag', 'belepes-feloldas', 'csp'] },
  { fake: true, tests: ['weblap-javitasok', 'weblap-galeria', 'weblap-kepek'] },
  // rejtett admin: a szerver a titkos belépő címmel (ADMIN_PATH) fut
  { fake: false, env: { ADMIN_PATH: '/kapu-teszt-2026' }, tests: ['admin-kapu'] },
  // bekapcsolt gyorsítótárral (lib/publicCache.js; fejlesztéskor egyébként ki van kapcsolva)
  { fake: false, env: { PUBLIC_CACHE: '1', CRON_SECRET: 'e2e-cron-titok' }, tests: ['gyorsitotar'] },
  // tesztkörnyezet (lib/testEnv.js): saját adatbázis, csak a tesztfiókokkal belépve
  { fake: false, env: { TEST_ENV: '1', TEST_USERS: 'TesztTulaj, TavernAdmin', MONGODB_DB: 'TavernTeszt', TEST_SETUP_SECRET: 'e2e-teszt-kulcs' }, tests: ['tesztkornyezet'] },
  // levelezéssel és Drive-mentéssel: a tesztszerver a hamis SMTP- és Google-szervernek küld (tests/e2e/fake-smtp.mjs, fake-gdrive.mjs; a tesztfájl indítja)
  { fake: false, env: { SMTP_HOST: '127.0.0.1', SMTP_PORT: '25871', SMTP_USER: 'bolt@teszt.hu', SMTP_PASS: 'x', SMTP_INSECURE_TEST: '1', CRON_SECRET: 'e2e-cron-titok', GOOGLE_DRIVE_TEST_BASE: 'http://127.0.0.1:25872', GOOGLE_DRIVE_CLIENT_ID: 'teszt-ugyfel', GOOGLE_DRIVE_CLIENT_SECRET: 'teszt-titok', GOOGLE_DRIVE_REFRESH_TOKEN: 'teszt-frissito' }, tests: ['elorendeles-stripe', 'elorendeles-kerdes', 'elorendeles-ertesites', 'admin-levelek-valasz', 'teljes-nev', 'takaritas-mentes', 'korlevel'] },
];
const only = process.argv.slice(2);
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const listening = async () => { try { await fetch(URL_); return true; } catch { return false; } };
// Node 26: ha a port-ellenőrzés kapcsolata épp leálló szerverhez megy, a beépített fetch elkapatlan setTypeOfService
// EINVAL hibát dob; ez csak annyit jelent, hogy a szerver még nem / már nem figyel, a futást nem szakíthatja meg
process.on('uncaughtException', (err) => { if (err?.syscall === 'setTypeOfService') return; throw err; });

// A tesztszerver indítása: a kimenetének utolsó sorai hiba esetén látszanak; ha a szerver kilép, nem várunk tovább
function startServer(fake, extraEnv = {}) {
  const tail = [];
  const keep = (d) => { tail.push(...String(d).split('\n')); tail.splice(0, Math.max(0, tail.length - 30)); };
  const proc = spawn(process.execPath, [`${HERE}server.mjs`], { env: { ...process.env, ...extraEnv, FAKE_IMGBB: fake ? '1' : '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  proc.stdout.on('data', keep);
  proc.stderr.on('data', keep);
  let exited = false;
  proc.on('exit', () => { exited = true; });
  const ready = async () => {
    for (let i = 0; i < 240; i++) {
      if (exited) throw new Error(`A tesztszerver leállt indulás közben:\n${tail.join('\n')}`);
      if (await listening()) return;
      await wait(1000);
    }
    throw new Error(`A tesztszerver nem indult el 4 perc alatt:\n${tail.join('\n')}`);
  };
  return { proc, ready, isAlive: () => !exited, tail };
}

// Bemelegítés: a fő oldalak első (hideg) fordítása itt történik meg, ne az első teszt időkeretében
async function warmUp() {
  for (const path of ['/', '/admin', '/naptar', '/weblapteszt/admin', '/esemeny/x', '/asztalfoglalas', '/elorendeles']) {
    // redirect: manual: a tesztkörnyezet köre belépés nélkül az élő oldalra irányítana
    try { await fetch(`http://localhost:3179${path}`, { redirect: "manual", signal: AbortSignal.timeout(5 * 60 * 1000) }); } catch { /* a teszt majd jelzi */ }
  }
}

// A következő kör előtt a régi szervernek tényleg le kell állnia (különben a teszt egy leálló szerverbe fut)
async function gone() {
  for (let i = 0; i < 60; i++) {
    if (!(await listening())) return;
    await wait(500);
  }
  throw new Error('A tesztszerver nem állt le 30 mp alatt.');
}

// A futás jegyzőkönyve a képes beszámolóhoz (gallery.mjs): tesztenként a kezdete, a vége, az eredménye és a kiírt sorai.
// A képernyőképeket az időpontjuk alapján rendeli a tesztekhez.
mkdirSync(`${HERE}shots`, { recursive: true });
const LOG = { startedAt: Date.now(), endedAt: null, tests: [] };
const saveLog = () => { try { writeFileSync(`${HERE}shots/_futas.json`, JSON.stringify(LOG)); } catch { /* a beszámoló nem fontosabb a tesztnél */ } };

const run = (file, round) => new Promise(resolve => {
  const entry = { name: file, fake: !!round?.fake, start: Date.now(), end: null, ok: null, lines: [] };
  LOG.tests.push(entry);
  const child = spawn(process.execPath, [`${HERE}${file}.mjs`], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  let buf = '';
  const take = (d, out) => {
    out.write(d);
    buf += String(d);
    const parts = buf.split('\n'); buf = parts.pop();
    entry.lines.push(...parts.filter(l => l.trim()).map(l => l.slice(0, 500)));
    if (entry.lines.length > 400) entry.lines.splice(0, entry.lines.length - 400);
  };
  child.stdout.on('data', d => take(d, process.stdout));
  child.stderr.on('data', d => take(d, process.stderr));
  const timer = setTimeout(() => { const m = `  IDŐTÚLLÉPÉS: ${file} (${TEST_TIMEOUT / 60000} perc)`; console.log(m); entry.lines.push(m); child.kill('SIGKILL'); }, TEST_TIMEOUT);
  child.on('exit', code => {
    clearTimeout(timer);
    if (buf.trim()) entry.lines.push(buf.slice(0, 500));
    Object.assign(entry, { end: Date.now(), ok: code === 0 });
    saveLog();
    resolve(code === 0);
  });
});

if (await listening()) {
  console.error('A 3179-es porton már fut valami (talán egy előző tesztszerver). Állítsd le, és futtasd újra.');
  process.exit(1);
}

const failed = [];
for (const round of ROUNDS) {
  const tests = round.tests.filter(t => existsSync(`${HERE}${t}.mjs`) && (!only.length || only.includes(t)));
  if (!tests.length) continue;
  const server = startServer(round.fake, round.env);
  try {
    await server.ready();
    await warmUp();
    for (const t of tests) {
      console.log(`\n== ${t}${round.fake ? ' (ál-ImgBB)' : ''}${round.env?.ADMIN_PATH ? ' (rejtett admin)' : ''}${round.env?.SMTP_HOST ? ' (levelezéssel)' : ''}`);
      if (!server.isAlive()) { console.log(`  A tesztszerver közben leállt:\n${server.tail.join('\n')}`); failed.push(t); continue; }
      if (!(await run(t, round))) failed.push(t);
    }
  } catch (err) {
    console.error(err.message);
    failed.push(...tests);
  } finally {
    server.proc.kill('SIGTERM');
    await gone();
  }
}
LOG.endedAt = Date.now();
LOG.failed = failed;
saveLog();
console.log(failed.length ? `\nHIBÁS: ${failed.join(', ')}` : '\nMinden e2e teszt rendben.');
console.log('Képes beszámoló: node tests/e2e/gallery.mjs');
process.exit(failed.length ? 1 : 0);
