// Az e2e tesztek futtatója (npm run test:e2e): elindítja a tesztszervert, egymás után lefuttatja a teszteket, a végén leállít.
// Két kör: a szokásos (képfeltöltés kulcs nélkül), és egy ál-ImgBB-vel (sikeres feltöltések) a feltöltési versenyhelyzetekhez.
// Egy fájl: npm run test:e2e -- naptar-havi
// Előfeltétel: Google Chrome (CHROME_PATH-szal felülírható); a 3179-es port szabad; ne fusson közben másik `next dev` ebben a mappában.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const URL_ = 'http://localhost:3179/api/auth/session';
const TEST_TIMEOUT = 10 * 60 * 1000; // egy tesztfájl legfeljebb ennyi ideig fut
const ROUNDS = [
  { fake: false, tests: ['weblap-jog', 'weblap-mozaik', 'weblap-ligak', 'weblap-felulet', 'naptar-havi', 'naptar-oldalak', 'naptar-esemeny', 'admin'] },
  { fake: true, tests: ['weblap-javitasok'] },
];
const only = process.argv.slice(2);
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const listening = async () => { try { await fetch(URL_); return true; } catch { return false; } };

// A tesztszerver indítása: a kimenetének utolsó sorai hiba esetén látszanak; ha a szerver kilép, nem várunk tovább
function startServer(fake) {
  const tail = [];
  const keep = (d) => { tail.push(...String(d).split('\n')); tail.splice(0, Math.max(0, tail.length - 30)); };
  const proc = spawn(process.execPath, [`${HERE}server.mjs`], { env: { ...process.env, FAKE_IMGBB: fake ? '1' : '' }, stdio: ['ignore', 'pipe', 'pipe'] });
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

// A következő kör előtt a régi szervernek tényleg le kell állnia (különben a teszt egy leálló szerverbe fut)
async function gone() {
  for (let i = 0; i < 60; i++) {
    if (!(await listening())) return;
    await wait(500);
  }
  throw new Error('A tesztszerver nem állt le 30 mp alatt.');
}

const run = (file) => new Promise(resolve => {
  const child = spawn(process.execPath, [`${HERE}${file}.mjs`], { stdio: 'inherit' });
  const timer = setTimeout(() => { console.log(`  IDŐTÚLLÉPÉS: ${file} (${TEST_TIMEOUT / 60000} perc)`); child.kill('SIGKILL'); }, TEST_TIMEOUT);
  child.on('exit', code => { clearTimeout(timer); resolve(code === 0); });
});

if (await listening()) {
  console.error('A 3179-es porton már fut valami (talán egy előző tesztszerver). Állítsd le, és futtasd újra.');
  process.exit(1);
}

const failed = [];
for (const round of ROUNDS) {
  const tests = round.tests.filter(t => existsSync(`${HERE}${t}.mjs`) && (!only.length || only.includes(t)));
  if (!tests.length) continue;
  const server = startServer(round.fake);
  try {
    await server.ready();
    for (const t of tests) {
      console.log(`\n== ${t}${round.fake ? ' (ál-ImgBB)' : ''}`);
      if (!server.isAlive()) { console.log(`  A tesztszerver közben leállt:\n${server.tail.join('\n')}`); failed.push(t); continue; }
      if (!(await run(t))) failed.push(t);
    }
  } catch (err) {
    console.error(err.message);
    failed.push(...tests);
  } finally {
    server.proc.kill('SIGTERM');
    await gone();
  }
}
console.log(failed.length ? `\nHIBÁS: ${failed.join(', ')}` : '\nMinden e2e teszt rendben.');
process.exit(failed.length ? 1 : 0);
