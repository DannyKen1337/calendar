// Tesztszerver: memóriabeli MongoDB + next dev a 3179-es porton; a Mongo címét a .uri fájlba írja.
// FAKE_IMGBB=1: a képfeltöltés (ImgBB) 1,5 mp után sikeres ál-választ ad (fake-imgbb.mjs), a termékkód változatlan.
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SECRET = 'e2e_secret_e2e_secret_e2e_secret_123';
const fake = !!process.env.FAKE_IMGBB;
const mongod = await MongoMemoryServer.create();
writeFileSync(new URL('./.uri', import.meta.url), mongod.getUri());
// a next közvetlenül a Node-dal indul (Windowson az npx csak héjon át futna)
const next = spawn(process.execPath, [fileURLToPath(new URL('../../node_modules/next/dist/bin/next', import.meta.url)), 'dev', '-p', '3179'], {
  cwd: ROOT,
  env: { ...process.env, MONGODB_URI: mongod.getUri(), JWT_SECRET: SECRET, CALENDAR_URL: 'http://localhost:3179', NEXT_PUBLIC_CALENDAR_URL: 'http://localhost:3179', NODE_ENV: 'development', E2E_NO_DEV_CACHE: '1', EMAIL_MX_FAKE: '1', IMGBB_API_KEY: fake ? 'fake' : '', RESEND_API_KEY: '', NODE_OPTIONS: fake ? `--import ${new URL('./fake-imgbb.mjs', import.meta.url).href}` : '' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
next.stdout.on('data', d => process.stdout.write(d));
next.stderr.on('data', d => process.stderr.write(d));
const stop = async () => { next.kill('SIGTERM'); await mongod.stop(); process.exit(0); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
next.on('exit', async () => { await mongod.stop(); process.exit(0); });
