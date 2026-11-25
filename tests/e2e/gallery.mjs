// Képes beszámoló az utolsó e2e futásról: egy önálló HTML oldal, tesztenként az eredménnyel, az ellenőrzésekkel és a
// közben készült képernyőképekkel (a képek beágyazva, kicsinyítve). A run.mjs jegyzőkönyvéből (shots/_futas.json)
// dolgozik; a képeket az időpontjuk alapján rendeli a tesztekhez. Használat: node tests/e2e/gallery.mjs [kimenet.html]
// Alapból: tests/e2e/shots/beszamolo.html (a shots mappa nincs a gitben).
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SHOTS = fileURLToPath(new URL('./shots/', import.meta.url));
const OUT = process.argv[2] || `${SHOTS}beszamolo.html`;
const MAX_BYTES = 13 * 1024 * 1024; // az oldal 16 MB alatt maradjon

const log = existsSync(`${SHOTS}_futas.json`) ? JSON.parse(readFileSync(`${SHOTS}_futas.json`, 'utf8')) : null;
if (!log) { console.error('Nincs futási jegyzőkönyv (shots/_futas.json): előbb futtasd a teszteket (node tests/e2e/run.mjs).'); process.exit(1); }

const files = readdirSync(SHOTS).filter(f => /\.(jpe?g|png)$/i.test(f)).map(f => ({ f, t: statSync(SHOTS + f).mtimeMs }));
const byTest = new Map(log.tests.map(t => [t, []]));
for (const file of files) {
  const t = log.tests.find(x => x.end && file.t >= x.start - 500 && file.t <= x.end + 2000);
  if (t) byTest.get(t).push(file);
}
for (const list of byTest.values()) list.sort((a, b) => a.t - b.t);

// kicsinyítés: ha sok a kép, kisebbre
const total = [...byTest.values()].reduce((n, l) => n + l.length, 0);
const width = total > 120 ? 760 : total > 70 ? 880 : 1000;
let bytes = 0;
const enc = async (file) => {
  const buf = await sharp(SHOTS + file.f).resize({ width, withoutEnlargement: true }).jpeg({ quality: 68, mozjpeg: true }).toBuffer();
  const meta = await sharp(buf).metadata();
  bytes += buf.length;
  return { name: file.f.replace(/\.(jpe?g|png)$/i, ''), src: `data:image/jpeg;base64,${buf.toString('base64')}`, w: meta.width, h: meta.height, at: file.t };
};

const tests = [];
for (const t of log.tests) {
  const shots = [];
  for (const file of byTest.get(t)) {
    if (bytes > MAX_BYTES) break;
    shots.push(await enc(file));
  }
  const checks = t.lines.map(l => l.trim()).filter(l => /^(ok -|NOT OK -|IDŐTÚLLÉPÉS)/.test(l))
    .map(l => ({ ok: l.startsWith('ok -'), text: l.replace(/^(ok -|NOT OK -)\s*/, '') }));
  const notes = t.lines.map(l => l.trim()).filter(l => l && !/^(ok -|NOT OK -|\d+ ok, \d+ hiba)/.test(l) && !/^böngészőhibák: nincs$/.test(l)).slice(-30);
  tests.push({ name: t.name, fake: t.fake, ok: t.ok, ms: (t.end || t.start) - t.start, checks, notes, shots });
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const when = (ms) => new Date(ms).toLocaleString('hu-HU', { timeZone: 'Europe/Budapest', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const dur = (ms) => (ms >= 60000 ? `${Math.floor(ms / 60000)} perc ${Math.round((ms % 60000) / 1000)} mp` : `${Math.round(ms / 1000)} mp`);
const failedTests = tests.filter(t => !t.ok);
const nChecks = tests.reduce((n, t) => n + t.checks.length, 0);
const nBad = tests.reduce((n, t) => n + t.checks.filter(c => !c.ok).length, 0);
const nShots = tests.reduce((n, t) => n + t.shots.length, 0);
const label = (name) => name.replace(/-/g, ' ');

const card = (t, i) => `
<section class="test${t.ok ? '' : ' bad'}" id="t-${esc(t.name)}" data-ok="${t.ok ? 1 : 0}" data-shots="${t.shots.length}" data-name="${esc(t.name)}">
  <header class="thead">
    <span class="chip ${t.ok ? 'chip-ok' : 'chip-bad'}">${t.ok ? 'Rendben' : 'Hibás'}</span>
    <h2>${esc(label(t.name))}</h2>
    <span class="meta">${t.checks.length} ellenőrzés${t.checks.some(c => !c.ok) ? ` · <b class="badtxt">${t.checks.filter(c => !c.ok).length} hiba</b>` : ''} · ${t.shots.length} kép · ${dur(t.ms)}${t.fake ? ' · ál-ImgBB' : ''}</span>
  </header>
  ${t.shots.length ? `<div class="shots">${t.shots.map((s, j) => `
    <button type="button" class="shot" data-i="${i}" data-j="${j}" aria-label="${esc(s.name)} megnyitása">
      <span class="frame${s.w < 500 ? ' phone' : ''}"><img src="${s.src}" alt="${esc(s.name)}" width="${s.w}" height="${s.h}" loading="lazy"></span>
      <span class="cap">${esc(label(s.name))}</span>
    </button>`).join('')}</div>` : '<p class="noshot">Ehhez a teszthez nem készült kép.</p>'}
  <details class="checks"${t.ok ? '' : ' open'}>
    <summary>Ellenőrzések</summary>
    <ul>${t.checks.map(c => `<li class="${c.ok ? 'c-ok' : 'c-bad'}"><span class="mark" aria-hidden="true">${c.ok ? '✓' : '✕'}</span><span>${esc(c.text)}</span></li>`).join('')}</ul>
    ${t.notes.length ? `<pre class="notes">${esc(t.notes.join('\n'))}</pre>` : ''}
  </details>
</section>`;

const html = `<title>Tavern tesztfutás</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Manrope:wght@400;600;700;800&display=swap">
<style>
/* Elrendezés: fejléc összesítéssel és szűrőkkel, alatta tesztenként egy blokk (eredmény, képek rácsban, ellenőrzések). */
:root {
  --bg: #121012; --panel: #1b1416; --line: #33262a; --fg: #ece2d4; --muted: #a8979a; --gold: #e5b15d; --goldfg: #1a1206;
  --ok: #7fcf9b; --okbg: #183022; --bad: #ff8a80; --badbg: #3a1716; --shade: rgba(8, 6, 7, .92);
  --f-display: 'Cinzel', 'Trajan Pro', Georgia, serif; --f-text: 'Manrope', system-ui, -apple-system, 'Segoe UI', sans-serif;
  color-scheme: dark;
}
@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) {
  --bg: #f6f1ea; --panel: #fffdf9; --line: #e4d8c8; --fg: #2a1f1c; --muted: #75655f; --gold: #9a6a1c; --goldfg: #fffaf0;
  --ok: #1f7a43; --okbg: #e2f3e8; --bad: #b3261e; --badbg: #fbe4e1; --shade: rgba(20, 14, 12, .9); color-scheme: light; } }
:root[data-theme="light"] {
  --bg: #f6f1ea; --panel: #fffdf9; --line: #e4d8c8; --fg: #2a1f1c; --muted: #75655f; --gold: #9a6a1c; --goldfg: #fffaf0;
  --ok: #1f7a43; --okbg: #e2f3e8; --bad: #b3261e; --badbg: #fbe4e1; --shade: rgba(20, 14, 12, .9); color-scheme: light; }
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--fg); font: 15px/1.5 var(--f-text); padding-block: 24px 64px;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.wrap { max-width: 1180px; margin: 0 auto; display: grid; gap: 20px; }
h1, h2 { font-family: var(--f-display); text-wrap: balance; margin: 0; }
h1 { font-size: clamp(26px, 4vw, 38px); color: var(--gold); letter-spacing: .02em; }
.top { display: grid; gap: 12px; }
.sum { display: flex; flex-wrap: wrap; gap: 8px 18px; color: var(--muted); font-variant-numeric: tabular-nums; }
.sum b { color: var(--fg); }
.verdict { display: inline-flex; align-items: center; gap: 10px; font-weight: 800; font-size: 17px; }
.verdict.ok { color: var(--ok); } .verdict.bad { color: var(--bad); }
.bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5;
  background: var(--bg); padding-block: 10px; border-bottom: 1px solid var(--line); }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--bg); }
.seg { display: inline-flex; border: 1px solid var(--line); border-radius: 999px; overflow: hidden; }
.seg button { font: 600 14px var(--f-text); color: var(--muted); background: transparent; border: 0; padding: 8px 14px; min-height: 40px; cursor: pointer; }
.seg button[aria-pressed="true"] { background: var(--gold); color: var(--goldfg); }
.bar input { flex: 1 1 180px; min-width: 0; font: 15px var(--f-text); color: var(--fg); background: var(--panel); border: 1px solid var(--line); border-radius: 999px; padding: 8px 14px; min-height: 40px; }
:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.jump { display: flex; flex-wrap: wrap; gap: 6px; }
.jump a { font-size: 13px; color: var(--bad); background: var(--badbg); border-radius: 999px; padding: 3px 10px; text-decoration: none; font-weight: 700; }
.test { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 16px; display: grid; gap: 14px; min-width: 0; }
.test.bad { border-color: var(--bad); }
.thead { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 12px; }
.thead h2 { font-size: 19px; text-transform: capitalize; }
.meta { color: var(--muted); font-size: 13px; font-variant-numeric: tabular-nums; }
.badtxt { color: var(--bad); }
.chip { font: 800 11px var(--f-text); letter-spacing: .08em; text-transform: uppercase; border-radius: 999px; padding: 3px 9px; align-self: center; }
.chip-ok { color: var(--ok); background: var(--okbg); } .chip-bad { color: var(--bad); background: var(--badbg); }
.shots { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr)); gap: 14px; align-items: start; }
.shot { display: grid; gap: 6px; background: none; border: 0; padding: 0; text-align: left; cursor: zoom-in; color: inherit; font: inherit; min-width: 0; }
.frame { display: block; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; max-height: 360px; background: var(--bg); }
.frame.phone { max-width: 170px; }
.frame img { display: block; width: 100%; height: auto; transition: transform .25s ease; }
.shot:hover .frame img { transform: scale(1.02); }
.cap { font-size: 13px; color: var(--muted); overflow-wrap: anywhere; }
.noshot { color: var(--muted); margin: 0; font-size: 14px; }
.checks summary { cursor: pointer; color: var(--gold); font-weight: 700; font-size: 14px; min-height: 32px; display: flex; align-items: center; }
.checks ul { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 4px; }
.checks li { display: grid; grid-template-columns: 18px 1fr; gap: 8px; font-size: 14px; overflow-wrap: anywhere; }
.c-ok .mark { color: var(--ok); } .c-bad { color: var(--bad); font-weight: 700; } .c-bad .mark { color: var(--bad); }
.notes { margin: 10px 0 0; padding: 10px; border-radius: 8px; background: var(--bg); color: var(--muted); font-size: 12px; overflow-x: auto; white-space: pre-wrap; }
.empty { color: var(--muted); text-align: center; padding: 30px; }
.lb { position: fixed; inset: 0; z-index: 20; background: var(--shade); display: grid; grid-template-rows: auto 1fr auto; gap: 10px;
  padding: calc(12px + env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px)) calc(12px + env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px)); }
.lb-top { display: flex; justify-content: space-between; align-items: center; gap: 12px; color: #ece2d4; }
.lb-top b { font-family: var(--f-display); text-transform: capitalize; }
.lb-img { min-height: 0; overflow: auto; display: grid; place-items: start center; }
.lb-img img { max-width: 100%; height: auto; border-radius: 8px; }
.lb-nav { display: flex; justify-content: center; gap: 10px; }
.lb button { font: 700 14px var(--f-text); color: #1a1206; background: #e5b15d; border: 0; border-radius: 999px; padding: 10px 18px; min-height: 44px; min-width: 44px; cursor: pointer; }
@media (prefers-reduced-motion: reduce) { .frame img { transition: none; } }
</style>
<div class="wrap">
  <div class="top">
    <h1>Tavern tesztfutás</h1>
    <div class="verdict ${failedTests.length ? 'bad' : 'ok'}">${failedTests.length ? `${failedTests.length} teszt hibás` : 'Minden teszt rendben'}</div>
    <div class="sum">
      <span>${esc(when(log.startedAt))}</span>
      <span><b>${tests.length}</b> teszt</span>
      <span><b>${nChecks}</b> ellenőrzés${nBad ? `, ebből <b class="badtxt">${nBad} hibás</b>` : ''}</span>
      <span><b>${nShots}</b> képernyőkép</span>
      ${log.endedAt ? `<span>${dur(log.endedAt - log.startedAt)}</span>` : '<span>a futás még nem ért véget</span>'}
    </div>
    ${failedTests.length ? `<div class="jump">${failedTests.map(t => `<a href="#t-${esc(t.name)}">${esc(label(t.name))}</a>`).join('')}</div>` : ''}
  </div>
  <div class="bar" role="search">
    <div class="seg" role="group" aria-label="Szűrés">
      <button type="button" data-f="all" aria-pressed="true">Mind</button>
      <button type="button" data-f="bad" aria-pressed="false">Hibás</button>
      <button type="button" data-f="shots" aria-pressed="false">Képes</button>
    </div>
    <input id="q" type="search" placeholder="Teszt neve, pl. levelek" aria-label="Keresés a tesztek között">
  </div>
  <div id="list">${tests.map(card).join('')}<p class="empty" id="none" hidden>Nincs ilyen teszt.</p></div>
</div>
<div class="lb" id="lb" hidden role="dialog" aria-modal="true" aria-label="Képernyőkép">
  <div class="lb-top"><b id="lbt"></b><button type="button" id="lbx">Bezárás</button></div>
  <div class="lb-img"><img id="lbi" alt=""></div>
  <div class="lb-nav"><button type="button" id="lbp" aria-label="Előző kép">‹ Előző</button><button type="button" id="lbn" aria-label="Következő kép">Következő ›</button></div>
</div>
<script>
(() => {
  const list = document.getElementById('list');
  const tests = [...list.querySelectorAll('.test')];
  const q = document.getElementById('q');
  let f = 'all';
  const apply = () => {
    const s = q.value.trim().toLowerCase().replace(/\\s+/g, '-');
    let shown = 0;
    for (const t of tests) {
      const v = (f === 'all' || (f === 'bad' && t.dataset.ok === '0') || (f === 'shots' && +t.dataset.shots > 0)) && (!s || t.dataset.name.includes(s));
      t.hidden = !v; if (v) shown++;
    }
    document.getElementById('none').hidden = shown > 0;
  };
  document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
    f = b.dataset.f; document.querySelectorAll('.seg button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); apply();
  }));
  q.addEventListener('input', apply);
  // nagyító: az összes kép sorban, tesztenként
  const all = tests.flatMap(t => [...t.querySelectorAll('.shot')].map(b => ({ b, test: t.dataset.name })));
  const lb = document.getElementById('lb'), img = document.getElementById('lbi'), title = document.getElementById('lbt');
  let cur = 0, last = null;
  const show = (k) => {
    cur = (k + all.length) % all.length;
    const { b, test } = all[cur]; const src = b.querySelector('img');
    img.src = src.src; img.alt = src.alt; title.textContent = test.replace(/-/g, ' ') + ' · ' + src.alt.replace(/-/g, ' ');
  };
  all.forEach(({ b }, k) => b.addEventListener('click', () => { last = b; show(k); lb.hidden = false; document.getElementById('lbx').focus(); }));
  const close = () => { lb.hidden = true; last?.focus(); };
  document.getElementById('lbx').addEventListener('click', close);
  document.getElementById('lbp').addEventListener('click', () => show(cur - 1));
  document.getElementById('lbn').addEventListener('click', () => show(cur + 1));
  lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
  document.addEventListener('keydown', (e) => {
    if (lb.hidden) return;
    if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') show(cur - 1); else if (e.key === 'ArrowRight') show(cur + 1);
  });
})();
</script>
`;
writeFileSync(OUT, html);
console.log(`Képes beszámoló: ${OUT} (${tests.length} teszt, ${nShots} kép, ${(Buffer.byteLength(html) / 1048576).toFixed(1)} MB)`);
