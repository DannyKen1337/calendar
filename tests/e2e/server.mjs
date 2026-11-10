// Tesztszerver: memóriabeli MongoDB + next dev a 3179-es porton; a Mongo címét a .uri fájlba írja.
// FAKE_IMGBB=1: a képfeltöltés (ImgBB) 1,5 mp után sikeres ál-választ ad (fake-imgbb.mjs), a termékkód változatlan.
import { MongoMemoryServer } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SECRET = 'e2e_secret_e2e_secret_e2e_secret_123';
const fake = !!process.env.FAKE_IMGBB;
const mongod = await MongoMemoryServer.create();
writeFileSync(new URL('./.uri', import.meta.url), mongod.getUri());
const next = spawn('npx', ['next', 'dev', '-p', '3179'], {
  cwd: ROOT,
  env: { ...process.env, MONGODB_URI: mongod.getUri(), JWT_SECRET: SECRET, NODE_ENV: 'development', IMGBB_API_KEY: fake ? 'fake' : '', RESEND_API_KEY: '', NODE_OPTIONS: fake ? `--import ${fileURLToPath(new URL('./fake-imgbb.mjs', import.meta.url))}` : '' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
next.stdout.on('data', d => process.stdout.write(d));
next.stderr.on('data', d => process.stderr.write(d));
const stop = async () => { next.kill('SIGTERM'); await mongod.stop(); process.exit(0); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
next.on('exit', async () => { await mongod.stop(); process.exit(0); });
