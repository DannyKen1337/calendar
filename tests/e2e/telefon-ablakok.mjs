// Telefonos admin: minden ablak (űrlap, lista) és az esemény ablaka végiggörgethető, az alja nem vágódik le, és a
// rögzített alsó gombsor nem takarja el az utolsó mezőt. Két telefonméreten (402×874 és 375×667): megnyitja az ablakot,
// minden görgethető részét a végére görgeti, és megnézi, hogy az utolsó tartalom a képernyőn (a gombsor fölött) van-e.
import { openDb, token, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';

const { client, db } = await openDb();
const owner = (await db.collection('users').insertOne({ username: 'AblakTulaj', email: 'at@x.hu', password: 'x', role: 'owner', lastSeenChangelog: '9999' })).insertedId;
const tok = await token(owner, 'AblakTulaj', 'owner');
const pad = (n) => String(n).padStart(2, '0');
const d = new Date();
const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ev = (await db.collection('tournaments').insertOne({ name: 'Hosszú Pokémon verseny', date: `${today}T23:30`, category: 'Pokémon TCG', store: 'debrecen', max_players: 40, current_players: 40, queue_count: 5, is_open: true, description: 'Leírás. '.repeat(40), createdAt: new Date() })).insertedId;
await db.collection('registrations').insertMany(Array.from({ length: 45 }, (_, i) => ({ tournamentId: String(ev), username: `Jatekos${i}`, name: `Játékos ${i}`, email: `j${i}@pelda.hu`, status: i < 40 ? 'Aktív' : 'Várólista', date: new Date(Date.now() - (50 - i) * 1000) })));
const prod = (await db.collection('preorder_products').insertOne({ name: 'Ablak ETB', category: 'Pokémon TCG', price: 19990, perPersonLimit: 0, isOpen: true, createdAt: new Date() })).insertedId;
await db.collection('preorders').insertMany(Array.from({ length: 30 }, (_, i) => ({ productId: String(prod), name: `Vevő ${i}`, email: `v${i}@pelda.hu`, phone: '+36 30 123 4567', quantity: 1, date: new Date() })));

// Az éppen nyitott ablak (vagy alsó lap): minden görgethető részét a végére görgeti, és megméri, hova esik az utolsó tartalom
async function measure(p) {
  await p.evaluate(() => {
    const roots = [...document.querySelectorAll('.ant-modal-wrap, .ant-drawer')].filter(el => getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0);
    for (const root of roots) for (const el of [root, ...root.querySelectorAll('*')]) {
      const cs = getComputedStyle(el);
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) el.scrollTop = el.scrollHeight;
    }
  });
  await wait(250);
  return p.evaluate(() => {
    const vh = window.innerHeight;
    const wraps = [...document.querySelectorAll('.ant-modal-wrap')].filter(el => getComputedStyle(el).display !== 'none' && el.querySelector('.ant-modal') && el.getBoundingClientRect().height > 0);
    const drawers = [...document.querySelectorAll('.ant-drawer')].filter(el => getComputedStyle(el).display !== 'none' && el.querySelector('.ant-drawer-body')?.getBoundingClientRect().height > 0);
    const root = wraps.at(-1) || drawers.at(-1);
    if (!root) return { none: true };
    const body = root.querySelector('.ant-modal-body') || root.querySelector('.ant-drawer-body');
    const footer = root.querySelector('.ant-modal-footer');
    const limit = Math.min(vh, footer ? footer.getBoundingClientRect().top : vh);
    // az utolsó (legalsó) látható tartalom a törzsben
    const items = [...body.querySelectorAll('*')].filter(el => { const r = el.getBoundingClientRect(); return r.height > 0 && r.width > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('.ant-select-dropdown, .ant-picker-dropdown, .ant-popover, .ant-tooltip'); });
    const lastBottom = Math.max(0, ...items.map(el => el.getBoundingClientRect().bottom));
    // levágott tartalom: rejtett túlcsordulású doboz, amiben a tartalom magasabb, mint a doboz
    const clipped = [root, ...root.querySelectorAll('*')].filter(el => {
      const cs = getComputedStyle(el);
      // a szándékos rövidítés (pl. hosszú leírás „Teljes leírás” gombbal) nem levágás
      if (cs.webkitLineClamp && cs.webkitLineClamp !== 'none') return false;
      return /(hidden|clip)/.test(cs.overflowY) && el.clientHeight > 60 && el.scrollHeight > el.clientHeight + 8 && !/ant-(select|picker|input|segmented|tabs-nav|table-header|image)/.test(el.className.toString());
    }).map(el => `${el.className.toString().split(' ').filter(c => c.startsWith('ant-') || c.includes('_')).slice(0, 2).join('.')} (${el.scrollHeight}>${el.clientHeight})`);
    const title = (root.querySelector('.ant-modal-title')?.textContent || root.querySelector('h2')?.textContent || '').slice(0, 40);
    return { title, lastBottom: Math.round(lastBottom), limit: Math.round(limit), clipped, vh };
  });
}
const report = (name, m, vh) => {
  const okBottom = !m.none && m.lastBottom <= m.limit + 2;
  ok(!m.none && okBottom && !m.clipped.length, `${vh}: ${name}${m.none ? ' – nem nyílt meg' : `: az alja elérhető (${m.lastBottom} ≤ ${m.limit})${m.clipped.length ? `, LEVÁGVA: ${m.clipped.join(', ')}` : ''}`}`);
};
const closeAll = async (p) => { await p.keyboard.press('Escape'); await wait(350); await p.keyboard.press('Escape'); await wait(350); };
const clickText = (p, text, sel = 'button, a, [role="button"]') => p.evaluate((t, s) => { const el = [...document.querySelectorAll(s)].find(x => x.textContent.trim() === t && x.getBoundingClientRect().height > 0); el?.click(); return !!el; }, text, sel);

const b = await browser();
try {
  for (const [w, h] of [[402, 874], [375, 667], [375, 560]]) {
    const p = await page(b, tok, w, h);
    await p.goto(`${BASE}/admin`, { waitUntil: 'networkidle2', timeout: 240000 });
    await p.waitForSelector('[data-kartya]', { timeout: 60000 }).catch(() => {});

    // az egész kártya megnyitja a teendőket (nem csak a címsor), a „›” jelzi
    ok(await p.$eval('[data-kartya] > button', el => !!el.querySelector('[aria-hidden="true"].anticon-right, .anticon-right')), `${w}×${h}: a kártyán „›” jelzi, hogy van mögötte több`);
    await p.$eval('[data-kartya]', el => el.scrollIntoView({ block: 'center' }));
    await wait(300);
    const card = await p.$('[data-kartya]');
    const cb = await card.boundingBox();
    await p.mouse.click(cb.x + cb.width - 20, cb.y + cb.height * 0.45); // a kártya üres része (nem gomb)
    await wait(700);
    ok(!!(await p.$('[data-esemeny-ablak]')), `${w}×${h}: a kártya bárhol koppintva megnyitja az esemény ablakát`);
    // középen, kártyaként (nem alulról, nem teljes képernyőn), jobb felső sarokban X; kívül kattintva bezárul
    const geo = await p.evaluate(() => {
      const box = document.querySelector('[data-esemeny-ablak]').closest('.ant-modal-container').getBoundingClientRect();
      const x = document.querySelector('.esemeny-ablak .ant-modal-close')?.getBoundingClientRect();
      return { left: box.left, right: innerWidth - box.right, top: box.top, bottom: innerHeight - box.bottom, x: x && { right: box.right - x.right, top: x.top - box.top, w: x.width } };
    });
    ok(geo.left >= 8 && geo.right >= 8 && Math.abs(geo.top - geo.bottom) < 40, `${w}×${h}: az esemény ablaka középen, kártyaként (${JSON.stringify({ l: Math.round(geo.left), r: Math.round(geo.right), t: Math.round(geo.top), b: Math.round(geo.bottom) })})`);
    ok(geo.x && geo.x.right < 30 && geo.x.top < 30 && geo.x.w >= 24, `${w}×${h}: jobb felső sarokban X`);
    const txt = await p.$eval('[data-esemeny-ablak]', el => el.innerText);
    ok(/Hosszú Pokémon verseny/.test(txt) && /Tavern Debrecen, Gambrinus köz/.test(txt) && /Szervező/.test(txt) && /Leírás/.test(txt) && /Jatekos0/.test(txt) && /40\s*\/\s*40/.test(txt) && /Szerkesztés/.test(txt), `${w}×${h}: az ablakban az esemény adatai (hely, szervező, leírás, létszám, jelentkezők) és a gombok`);
    await p.mouse.click(Math.max(4, geo.left / 2), 6 + Math.max(0, geo.top / 2)); // az ablakon kívül
    await wait(700);
    ok(!(await p.evaluate(() => !!document.querySelector('[data-esemeny-ablak]') && document.querySelector('[data-esemeny-ablak]').getBoundingClientRect().height > 0)), `${w}×${h}: az ablakon kívül kattintva bezárul`);
    // az X is bezárja
    await p.click('[data-kartya] > button'); await wait(700);
    await p.click('.esemeny-ablak .ant-modal-close'); await wait(700);
    ok(!(await p.evaluate(() => document.querySelector('[data-esemeny-ablak]')?.getBoundingClientRect().height > 0)), `${w}×${h}: az X bezárja`);
    // esemény ablaka: a végéig görgethető
    await p.click('[data-kartya] > button');
    await wait(700);
    report('esemény ablaka', await measure(p), `${w}×${h}`);
    await p.screenshot({ path: `${SHOTS}telefon-ablak-lap-${h}.jpg`, quality: 60 });
    // hosszú leírás: „Teljes leírás” gombbal kinyílik
    const before = await p.$eval('[data-esemeny-ablak] p[class*="dDescText"]', el => el.getBoundingClientRect().height);
    await clickText(p, 'Teljes leírás');
    await wait(300);
    const after = await p.$eval('[data-esemeny-ablak] p[class*="dDescText"]', el => el.getBoundingClientRect().height);
    ok(after > before + 20, `${w}×${h}: a hosszú leírás „Teljes leírás” gombbal kinyílik (${Math.round(before)} → ${Math.round(after)} px)`);
    // Jelentkezők (45 fő): az ablak gombjával
    await p.evaluate(() => [...document.querySelectorAll('[data-esemeny-ablak] button')].find(x => x.textContent.trim() === 'Jelentkezők')?.click());
    await wait(900);
    report('Jelentkezők ablak', await measure(p), `${w}×${h}`);
    const regs = await p.evaluate(() => {
      const body = [...document.querySelectorAll('.ant-modal-body')].find(b => b.getBoundingClientRect().height > 0);
      return { cards: body?.querySelectorAll('[data-jelentkezo]').length || 0, table: !!body?.querySelector('.ant-table'), addBtn: !!body?.querySelector('[data-hozzaadas-nyit]'), addForm: !!body?.querySelector('[data-hozzaadas]'), wide: body ? body.scrollWidth > body.clientWidth + 1 : true, focused: document.activeElement?.tagName };
    });
    ok(regs.cards === 45 && !regs.table && !regs.wide, `${w}×${h}: a jelentkezők kártyákon, semmi nem lóg ki oldalra (${regs.cards} kártya)`);
    ok(regs.addBtn && !regs.addForm && regs.focused !== 'INPUT', `${w}×${h}: a hozzáadás gomb mögött, nem ugrik fel a billentyűzet`);
    if (h === 874) {
      await p.evaluate(() => { const c = document.querySelectorAll('[data-jelentkezo]')[2]; c.scrollIntoView(); [...c.querySelectorAll('button')].find(x => x.textContent.trim() === 'Megjelent')?.click(); });
      await wait(1500);
      ok((await db.collection('registrations').findOne({ username: 'Jatekos2' }))?.attended === true, 'telefonon a kártya „Megjelent” gombja ment');
      await p.evaluate(() => document.querySelector('[data-hozzaadas-nyit]')?.click());
      await wait(400);
      ok(!!(await p.$('[data-hozzaadas]')) && await p.evaluate(() => document.activeElement?.tagName) === 'INPUT', 'a hozzáadás gombra nyílik ki az űrlap, és a felhasználónévre ugrik');
    }
    await p.screenshot({ path: `${SHOTS}telefon-ablak-jelentkezok-${h}.jpg`, quality: 60 });
    await closeAll(p);
    // Szerkesztés
    await p.click('[data-kartya] > button'); await wait(700);
    await clickText(p, 'Szerkesztés'); await wait(900);
    report('esemény szerkesztése', await measure(p), `${w}×${h}`);
    await p.screenshot({ path: `${SHOTS}telefon-ablak-szerkesztes-${h}.jpg`, quality: 60 });
    await closeAll(p);
    // Új esemény (lebegő +)
    await p.evaluate(() => document.querySelector('button[aria-label="Új esemény"]')?.click()); await wait(900);
    report('új esemény', await measure(p), `${w}×${h}`);
    await closeAll(p);

    // Előrendelések: új termék, Megérkezett
    await p.goto(`${BASE}/admin/elorendeles`, { waitUntil: 'networkidle2' });
    await p.waitForSelector('[data-megerkezett]', { timeout: 30000 }).catch(() => {});
    await clickText(p, 'Szerkesztés'); await wait(800);
    report('előrendelési termék szerkesztése', await measure(p), `${w}×${h}`);
    await closeAll(p);
    await p.click('[data-megerkezett]'); await wait(800);
    report('„Megérkezett” értesítő', await measure(p), `${w}×${h}`);
    await p.screenshot({ path: `${SHOTS}telefon-ablak-ertesito-${h}.jpg`, quality: 60 });
    await closeAll(p);

    // Felhasználók: új fiók
    await p.goto(`${BASE}/admin/felhasznalok`, { waitUntil: 'networkidle2' });
    await wait(800);
    await clickText(p, 'Új fiók'); await wait(800);
    report('új fiók', await measure(p), `${w}×${h}`);
    await closeAll(p);
    await p.close();
  }
} finally {
  await b.close(); await client.close(); summary();
}
