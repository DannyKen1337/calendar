// „Kérdésed van? Írj nekünk” (PreorderContact): kinyíló és bezáródó animáció (a felhasználó kérése). Kinyitáskor az űrlap
// magassága fokozatosan nő (nem ugrik), a fókusz a név mezőre kerül; bezáráskor fokozatosan összecsukódik, utána a gomb
// visszajön, és rá kerül a fókusz. Csökkentett mozgásnál animáció nélkül nyílik és zárul. A weboldalon és az előrendelő oldalon.
import { openDb, browser, page, ok, summary, wait, BASE } from './lib.mjs';

const { client } = await openDb();
const heights = (p, ms, step = 40) => p.evaluate(async (ms, step) => {
  const out = []; const end = performance.now() + ms;
  while (performance.now() < end) { const el = document.querySelector('[data-kerdes-ablak]'); out.push(el ? Math.round(el.getBoundingClientRect().height) : -1); await new Promise(r => setTimeout(r, step)); }
  return out;
}, ms, step);

const b = await browser();
try {
  for (const [path, name] of [['/', 'weboldal'], ['/elorendeles', 'előrendelés']]) {
    const p = await page(b, null, 1280, 900);
    await p.goto(`${BASE}${path}`, { waitUntil: 'networkidle2', timeout: 240000 });
    await p.waitForSelector('[data-kerdes-gomb]', { timeout: 60000 });
    await p.$eval('[data-kerdes-gomb]', el => el.scrollIntoView({ block: 'center' }));
    await wait(400);
    await p.click('[data-kerdes-gomb]');
    const grow = await heights(p, 600);
    const final = grow.at(-1);
    const mid = grow.filter(h => h > 0 && h < final - 20);
    ok(final > 200 && mid.length >= 2 && grow.every((h, i) => i === 0 || h >= grow[i - 1] - 1), `${name}: kinyitáskor fokozatosan nő (${grow.join(' → ')})`);
    ok(await p.$eval('[data-kerdes-ablak]', el => el.dataset.allapot) === 'nyitva', `${name}: a végén nyitva`);
    ok(await p.evaluate(() => document.activeElement?.id === 'kerdes-name'), `${name}: a fókusz a név mezőn`);
    await p.click('[data-kerdes] button[aria-label="Bezárás"]');
    const shrink = await heights(p, 650);
    const shrinking = shrink.filter(h => h > 0);
    ok(shrinking.length >= 2 && shrinking[0] > shrinking.at(-1) && shrink.at(-1) === -1, `${name}: bezáráskor fokozatosan összecsukódik (${shrink.join(' → ')})`);
    ok(await p.evaluate(() => document.activeElement?.hasAttribute('data-kerdes-gomb')), `${name}: utána a gomb visszajön, a fókusz rajta`);
    console.log(`  böngészőhibák (${name}):`, p.errs.join(' | ') || 'nincs');
    await p.close();
  }

  // csökkentett mozgás: rögtön nyílik és zárul
  const r = await page(b, null, 402, 874);
  await r.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await r.goto(`${BASE}/elorendeles`, { waitUntil: 'networkidle2', timeout: 240000 });
  await r.waitForSelector('[data-kerdes-gomb]', { timeout: 60000 });
  await r.click('[data-kerdes-gomb]');
  await wait(120);
  const hh = await r.evaluate(() => Math.round(document.querySelector('[data-kerdes-ablak]').getBoundingClientRect().height));
  ok(hh > 200, `csökkentett mozgásnál rögtön teljes magasságban nyílik (${hh})`);
  await r.click('[data-kerdes] button[aria-label="Bezárás"]');
  await wait(60);
  ok(!(await r.$('[data-kerdes-ablak]')) && !!(await r.$('[data-kerdes-gomb]')), 'csökkentett mozgásnál rögtön bezárul');
} finally {
  await b.close(); await client.close(); summary();
}
