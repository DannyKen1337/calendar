// Közös segédek az e2e tesztekhez: adatbázis (a tesztszerver memóriabeli Mongo-ja), sütik, böngésző, ellenőrzés.
// A tesztszervert a run.mjs indítja (server.mjs); a Mongo címe a .uri fájlban van.
import puppeteer from 'puppeteer-core';
import { readFileSync, mkdirSync } from 'node:fs';
import { MongoClient, ObjectId } from 'mongodb';
import { fileURLToPath } from 'node:url';
import { SignJWT } from 'jose';
import assert from 'node:assert/strict';
export { ObjectId };
export const SECRET = 'e2e_secret_e2e_secret_e2e_secret_123';
export const BASE = 'http://localhost:3179';
export const SHOTS = fileURLToPath(new URL('./shots/', import.meta.url));
mkdirSync(SHOTS, { recursive: true });
export const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const wait = (ms) => new Promise(r => setTimeout(r, ms));
let passed = 0, failed = 0;
export const ok = (c, name) => { if (c) { passed++; console.log('  ok -', name); } else { failed++; console.log('  NOT OK -', name); } };
export const summary = () => { console.log(`\n${passed} ok, ${failed} hiba`); if (failed) process.exitCode = 1; };

export async function openDb() {
  const client = await new MongoClient(readFileSync(new URL('./.uri', import.meta.url), 'utf8')).connect();
  const db = client.db('Tavern');
  await db.dropDatabase();
  return { client, db };
}
export const token = (id, username, role) => new SignJWT({ id: String(id), username, email: 'x', role }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(SECRET));
export const get = (url, cookie) => fetch(`${BASE}${url}`, { headers: cookie ? { Cookie: `tavern_session=${cookie}` } : {}, redirect: 'manual' });
export async function browser() {
  return puppeteer.launch({ executablePath: CHROME, headless: 'new' });
}
export async function page(b, cookie, w = 1280, h = 900) {
  const p = await b.newPage();
  await p.setViewport({ width: w, height: h, isMobile: w < 500, hasTouch: w < 500 });
  p.on('dialog', d => d.accept());
  p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  if (cookie) await b.setCookie({ name: 'tavern_session', value: cookie, domain: 'localhost', path: '/' });
  return p;
}
export const bodyText = (p) => p.evaluate(() => document.body.innerText);
export const clickText = (p, sel, text) => p.evaluate((s, t) => { const el = [...document.querySelectorAll(s)].find(e => e.textContent.includes(t)); if (!el) throw new Error('nincs: ' + t); el.click(); }, sel, text);
export { assert };
