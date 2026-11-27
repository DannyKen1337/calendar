// Admin betöltés: amíg az adatok töltődnek, üdvözlő képernyő a teljes névvel („Üdvözöllek, Kovács Kata!”), alatta
// eldobott 3D dobókocka (lib/d20.js). A név a következő betöltéskor rögtön látszik (a böngésző megjegyzi), kijelentkezéskor törlődik.
// Teljes név nélkül a felhasználónév. Gyors betöltésnél fel sem villan.
import { openDb, token, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';

const { client, db } = await openDb();
const ids = (await db.collection('users').insertMany([
  { username: 'kata77', fullName: 'Kovács Kata', email: 'k77@x.hu', password: 'x', role: 'owner', lastSeenChangelog: '9999' },
  { username: 'Nevtelen', email: 'nv@x.hu', password: 'x', role: 'admin', lastSeenChangelog: '9999' },
])).insertedIds;
const kata = await token(ids[0], 'kata77', 'owner');
const nevtelen = await token(ids[1], 'Nevtelen', 'admin');

// az admin adatok és a munkamenet lassítva, hogy a töltőképernyő látsszon
async function slowPage(b, tok, { w = 402, h = 874, sessionDelay = 0, dataDelay = 2500 } = {}) {
  const p = await page(b, tok, w, h);
  await p.setRequestInterception(true);
  p.on('request', async (r) => {
    const u = r.url();
    if (u.includes('/api/admin-data')) await wait(dataDelay);
    else if (u.includes('/api/auth/session') && sessionDelay) await wait(sessionDelay);
    r.continue().catch(() => {});
  });
  return p;
}
const welcome = (p) => p.$eval('[data-udvozlo]', el => el.innerText).catch(() => '');

const b = await browser();
try {
  const p = await slowPage(b, kata);
  await p.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await p.waitForFunction(() => /Üdvözöllek, Kovács Kata!/.test(document.querySelector('[data-udvozlo]')?.innerText || ''), { timeout: 30000 }).catch(() => {});
  const t = await welcome(p);
  ok(/Üdvözöllek, Kovács Kata!/.test(t) && /Betöltjük az adatokat/.test(t), `betöltés közben üdvözlés a teljes névvel (${t.replace(/\n/g, ' / ').slice(0, 80)})`);
  ok(!(await p.$('[data-kocka]')), 'rövid ideig csak az üdvözlés, a kocka hosszabb betöltésnél jön');
  await p.waitForSelector('[data-kocka]', { timeout: 5000 }).catch(() => {});
  await wait(200);
  const frame = () => p.$eval('[data-kocka]', c => c.toDataURL()).catch(() => '');
  const f1 = await frame(); await wait(300); const f2 = await frame();
  ok(!!f1 && f1.length > 2000, 'alatta a kocka (a vásznon rajzolva)');
  ok(f1 !== f2, 'a kocka mozog (a képkockák változnak)');
  ok((await p.evaluate(() => document.documentElement.scrollWidth)) === 402, 'telefonon nincs vízszintes görgetés');
  await p.screenshot({ path: `${SHOTS}admin-udvozlo.jpg`, quality: 70 });
  await p.waitForFunction(() => !document.querySelector('[data-udvozlo]'), { timeout: 40000 }).catch(() => {});
  ok(!(await p.$('[data-udvozlo]')), 'betöltés után eltűnik');
  ok(await p.evaluate(() => localStorage.getItem('tavern-admin-nev')) === 'Kovács Kata', 'a név megjegyezve a következő betöltéshez');

  // üdvözlés és kocka csak belépéskor: ugyanebben a lapban a következő (lassú) betöltésnél csak egy egyszerű töltő
  await p.goto(`${BASE}/admin/elorendeles`, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('[data-tolto]', { timeout: 30000 }).catch(() => {});
  await wait(1600);
  const plain = await p.evaluate(() => { const el = document.querySelector('[data-tolto]'); return el ? { text: el.innerText.trim(), spin: getComputedStyle(el.querySelector('span')).animationName } : null; });
  ok(plain && plain.text === '' && /spin/.test(plain.spin) && !(await p.$('[data-udvozlo]')) && !(await p.$('[data-kocka]')), `a következő betöltésnél csak egy egyszerű töltőanimáció, üdvözlés és kocka nélkül (${JSON.stringify(plain)})`);
  await p.screenshot({ path: `${SHOTS}admin-tolto.jpg`, quality: 60 });
  await p.waitForFunction(() => !document.querySelector('[data-tolto]'), { timeout: 40000 }).catch(() => {});
  // kijelentkezés után (új belépésnél) újra dob
  await p.goto(`${BASE}/admin?lap=tovabbiak`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => [...document.querySelectorAll('button, a')].some(x => x.textContent.trim() === 'Kijelentkezés'), { timeout: 40000 }).catch(() => {});
  await p.evaluate(() => [...document.querySelectorAll('button, a')].find(x => x.textContent.trim() === 'Kijelentkezés')?.click());
  await wait(1200);
  ok(await p.evaluate(() => sessionStorage.getItem('tavern-kocka-volt')) === null, 'kijelentkezéskor a kocka újra dobhat');
  await b.setCookie({ name: 'tavern_session', value: kata, domain: 'localhost', path: '/' });
  await p.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('[data-kocka]', { timeout: 15000 }).catch(() => {});
  ok(!!(await p.$('[data-kocka]')), 'újra belépve a kocka megint dob');
  await p.waitForFunction(() => !document.querySelector('[data-udvozlo]'), { timeout: 40000 }).catch(() => {});

  // a dobás eredménye: rögzített 7-esnél a kocka a 7-esen áll meg, nincs ünneplés; 20-asnál „Natural 20!”
  const seven = await slowPage(b, kata, { dataDelay: 6000 });
  await seven.evaluateOnNewDocument(() => { window.__D20_FORCE__ = 7; });
  await seven.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  await seven.waitForFunction(() => document.querySelector('[data-kocka]')?.dataset.dobas, { timeout: 15000 }).catch(() => {});
  ok(await seven.$eval('[data-kocka]', c => c.dataset.dobas).catch(() => '') === '7' && !(await seven.$('[data-natural20]')), 'a kocka a kidobott számon áll meg (7), ünneplés nélkül');
  await seven.close();
  const crit = await slowPage(b, kata, { dataDelay: 6000 });
  await crit.evaluateOnNewDocument(() => { window.__D20_FORCE__ = 20; });
  await crit.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  await crit.waitForSelector('[data-natural20]', { timeout: 15000 }).catch(() => {});
  ok(/Natural 20! Kritikus siker!/.test(await crit.$eval('[data-natural20]', el => el.textContent).catch(() => '')), '20-as dobásnál „Natural 20! Kritikus siker!” (easter egg)');
  await wait(300);
  await crit.screenshot({ path: `${SHOTS}admin-udvozlo-natural20.jpg`, quality: 70 });
  await crit.close();

  // ha az adat a dobás közben jön meg, a képernyő megvárja, amíg a kocka megáll (nem vágja félbe)
  const mid = await slowPage(b, kata, { dataDelay: 1700 });
  await mid.evaluateOnNewDocument(() => {
    window.__ts = {};
    new MutationObserver(() => {
      const c = document.querySelector('[data-kocka]');
      if (c?.dataset.dobas && !window.__ts.landed) window.__ts.landed = performance.now();
      if (document.querySelector('[data-kocka]') && !window.__ts.dice) window.__ts.dice = performance.now();
      if (window.__ts.dice && !document.querySelector('[data-udvozlo]') && !window.__ts.gone) window.__ts.gone = performance.now();
      if (document.querySelector('[data-booster="tear"]') && !window.__ts.tear) window.__ts.tear = performance.now();
    }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-dobas', 'data-booster'] });
  });
  await mid.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  await mid.waitForFunction(() => window.__ts?.gone, { timeout: 30000 }).catch(() => {});
  const ts = await mid.evaluate(() => window.__ts);
  ok(ts.dice && ts.landed && ts.gone && ts.gone >= ts.landed + 300, `a megkezdett dobás végéig marad (megállt: ${Math.round(ts.landed - ts.dice)} ms, eltűnt: ${Math.round(ts.gone - ts.dice)} ms a kocka megjelenése után)`);
  ok(ts.landed - ts.dice < 1700, `a dobás gyors (${Math.round(ts.landed - ts.dice)} ms alatt áll meg)`);
  await mid.close();

  // következő betöltés: a név rögtön látszik, még a munkamenet-ellenőrzés előtt
  const q = await slowPage(b, kata, { sessionDelay: 2500, dataDelay: 2500 });
  await q.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  await wait(1200);
  ok(/Üdvözöllek, Kovács Kata!/.test(await welcome(q)), 'a következő betöltéskor rögtön a név (a szerver válasza előtt)');
  await q.waitForFunction(() => !document.querySelector('[data-udvozlo]'), { timeout: 40000 }).catch(() => {});

  // teljes név nélkül a felhasználónév
  const n = await slowPage(b, nevtelen);
  await n.evaluate(() => {}).catch(() => {});
  await n.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  await n.evaluate(() => localStorage.removeItem('tavern-admin-nev'));
  await n.reload({ waitUntil: 'domcontentloaded' });
  await n.waitForFunction(() => /Üdvözöllek, Nevtelen!/.test(document.querySelector('[data-udvozlo]')?.innerText || ''), { timeout: 30000 }).catch(() => {});
  ok(/Üdvözöllek, Nevtelen!/.test(await welcome(n)), 'teljes név nélkül a felhasználónév');
  await n.waitForFunction(() => !document.querySelector('[data-udvozlo]'), { timeout: 40000 }).catch(() => {});

  // kijelentkezés: a megjegyzett név törlődik
  await n.goto(`${BASE}/admin?lap=tovabbiak`, { waitUntil: 'domcontentloaded' });
  await n.waitForFunction(() => [...document.querySelectorAll('button, a')].some(x => x.textContent.trim() === 'Kijelentkezés'), { timeout: 40000 }).catch(() => {});
  await n.evaluate(() => [...document.querySelectorAll('button, a')].find(x => x.textContent.trim() === 'Kijelentkezés')?.click());
  await wait(1500);
  const stillThere = await n.evaluate(() => localStorage.getItem('tavern-admin-nev'));
  ok(stillThere === null, `kijelentkezéskor a név törlődik (${stillThere})`);

  // aloldal (pl. Előrendelések) is üdvözöl
  await b.setCookie({ name: 'tavern_session', value: kata, domain: 'localhost', path: '/' });
  const e = await slowPage(b, kata, { w: 1280, h: 900 });
  await e.goto(`${BASE}/admin/elorendeles`, { waitUntil: 'domcontentloaded' });
  await e.waitForFunction(() => /Üdvözöllek, Kovács Kata!/.test(document.querySelector('[data-udvozlo]')?.innerText || ''), { timeout: 30000 }).catch(() => {});
  ok(/Üdvözöllek, Kovács Kata!/.test(await welcome(e)), 'az admin aloldalain is üdvözöl');
  await e.screenshot({ path: `${SHOTS}admin-udvozlo-gep.jpg`, quality: 70 });

  // csökkentett mozgás: nincs animáció, de az üdvözlés ott van
  const r = await slowPage(b, kata);
  await r.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await r.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  await r.waitForSelector('[data-kocka]', { timeout: 30000 }).catch(() => {});
  await wait(400);
  const r1 = await r.$eval('[data-kocka]', c => c.toDataURL()).catch(() => '');
  await wait(400);
  const r2 = await r.$eval('[data-kocka]', c => c.toDataURL()).catch(() => '');
  ok(!!r1 && r1.length > 2000 && r1 === r2 && /Üdvözöllek/.test(await welcome(r)), 'csökkentett mozgásnál álló kép (a kocka a 20-ason), az üdvözlés marad');
  console.log('  böngészőhibák:', [...p.errs, ...q.errs, ...n.errs, ...e.errs].join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
