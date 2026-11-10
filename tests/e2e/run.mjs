// Az e2e tesztek futtatója (npm run test:e2e): elindítja a tesztszervert, egymás után lefuttatja a teszteket, a végén leállít.
// Két kör: a szokásos (képfeltöltés kulcs nélkül), és egy ál-ImgBB-vel (sikeres feltöltések) a feltöltési versenyhelyzetekhez.
// Egy fájl: node tests/e2e/run.mjs naptar-havi
// Előfeltétel: Google Chrome (CHROME_PATH-szal felülírható); a 3179-es port szabad; ne fusson közben másik `next dev` ebben a mappában.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROUNDS = [
  { fake: false, tests: ['weblap-jog', 'weblap-mozaik', 'weblap-felulet', 'naptar-havi', 'naptar-oldalak', 'naptar-esemeny', 'admin'] },
  { fake: true, tests: ['weblap-javitasok'] },
];
const only = process.argv.slice(2);
const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function ready() {
  for (let i = 0; i < 240; i++) {
    try { if ((await fetch('http://localhost:3179/api/auth/session')).status) return; } catch { /* még indul */ }
    await wait(1000);
  }
  throw new Error('A tesztszerver nem indult el 4 perc alatt.');
}

// A következő kör előtt a régi szervernek tényleg le kell állnia (különben a teszt egy leálló szerverbe fut)
async function gone() {
  for (let i = 0; i < 60; i++) {
    try { await fetch('http://localhost:3179/api/auth/session'); } catch { return; }
    await wait(500);
  }
  throw new Error('A tesztszerver nem állt le 30 mp alatt.');
}

const run = (file) => new Promise(resolve => {
  const child = spawn(process.execPath, [`${HERE}${file}.mjs`], { stdio: 'inherit' });
  child.on('exit', code => resolve(code === 0));
});

const { existsSync } = await import('node:fs');
let failed = [];
for (const round of ROUNDS) {
  const tests = round.tests.filter(t => existsSync(`${HERE}${t}.mjs`) && (!only.length || only.includes(t)));
  if (!tests.length) continue;
  const server = spawn(process.execPath, [`${HERE}server.mjs`], { env: { ...process.env, FAKE_IMGBB: round.fake ? '1' : '' }, stdio: 'ignore' });
  try {
    await ready();
    for (const t of tests) {
      console.log(`\n== ${t}${round.fake ? ' (ál-ImgBB)' : ''}`);
      if (!(await run(t))) failed.push(t);
    }
  } finally {
    server.kill('SIGTERM');
    await gone();
  }
}
console.log(failed.length ? `\nHIBÁS: ${failed.join(', ')}` : '\nMinden e2e teszt rendben.');
process.exit(failed.length ? 1 : 0);
