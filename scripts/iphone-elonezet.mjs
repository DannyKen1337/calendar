// A tesztkörnyezet iPhone 17-es előnézete (az asztali „Tavern teszt – iPhone 17” indítja a scripts/iphone-elonezet.cmd-n át).
// Egy külön Chrome-ablakban valódi telefonként jeleníti meg: 402×874 CSS-pixel (az iPhone 17 képernyője, 3× sűrűség),
// érintés, mobil nézet és iPhone-os Safari böngészőazonosító; az új lapokra / ablakokra is. Saját Chrome-profil
// (%APPDATA%\TavernTeszt\iphone-profil, macOS-en ~/Library/Application Support/TavernTeszt/iphone-profil), így a belépés megmarad.
// Ha a tesztkörnyezet nem fut, szól (a .cmd előtte elindítja). Az ablak bezárásakor a program is kilép.
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const URL_ = process.env.TESZT_URL || 'http://localhost:3100/admin';
const DEVICE = {
  viewport: { width: 402, height: 874, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  // az iOS 26 Safari a rendszerverziót 18_6-on rögzíti a böngészőazonosítóban
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
};

const base = process.platform === 'win32' ? join(process.env.APPDATA || homedir(), 'TavernTeszt') : join(homedir(), 'Library', 'Application Support', 'TavernTeszt');
const chrome = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(p => p && existsSync(p));
if (!chrome) { console.error('Nem találom a Chrome-ot (vagy az Edge-et). Add meg a CHROME_PATH-szal.'); process.exit(1); }

try { await fetch(URL_, { redirect: 'manual' }); }
catch { console.error(`A tesztkörnyezet nem fut (${URL_}). Indítsd el a „Tavern teszt – indító” ikonnal.`); process.exit(1); }

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: false,
  defaultViewport: null,
  userDataDir: join(base, 'iphone-profil'),
  ignoreDefaultArgs: ['--enable-automation'],
  // alkalmazásablak címsor és címsáv nélkül, akkora, hogy a telefon képernyője pont kiférjen
  args: [`--app=${URL_}`, '--window-size=418,920', '--window-position=60,20', '--no-first-run', '--no-default-browser-check', '--lang=hu', '--disable-features=Translate'],
});

const emulate = async (page) => { try { await page.emulate(DEVICE); } catch { /* bezárt lap */ } };
// az új lapok (pl. az új lapon nyíló linkek) is telefonként nyílnak
browser.on('targetcreated', async (t) => { if (t.type() === 'page') { const p = await t.page(); if (p) { await emulate(p); await p.reload().catch(() => {}); } } });
for (const p of await browser.pages()) { await emulate(p); await p.reload().catch(() => {}); }

console.log(`iPhone 17 előnézet: ${URL_} (402×874). Bezárás: zárd be az ablakot.`);
browser.on('disconnected', () => process.exit(0));
