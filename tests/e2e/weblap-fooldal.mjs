// Weboldal, főoldal: a szakaszok sorrendje (Naptár, Ligák, Asztalfoglalás, Hírek, Galéria, Itt találsz minket (nyitvatartás és cím), Írj nekünk),
// az Előrendelés sáv közvetlenül a cégér alatt (beúszik), a nagy „teljes naptár” gomb, a boltok sorai fotó nélkül,
// a töltőképernyő (első betöltéskor 1–2 mp, hangulatszöveggel, utána eltűnik; munkamenetenként egyszer), és a
// naptárablak töltőképernyője a hangulatszöveggel. Gépen és telefonon.
import { openDb, browser, page, ok, summary, wait, SHOTS, BASE } from './lib.mjs';

const { client, db } = await openDb();
const ORDER = ['program', 'liga', 'asztalfoglalas', 'hirek', 'galeria', 'boltok', 'kapcsolat'];
const MOOD = /Minden héten verseny|Három bolt, egy klub|Ligák szezononként|Ne maradj le/;
const b = await browser();
try {
  await db.collection('preorder_products').insertMany([
    { name: 'Mega Evolution Booster Box', category: 'Pokémon TCG', price: 52990, releaseDate: '2026. december 5.', stock: 40, isOpen: true, createdAt: new Date() },
    { name: 'OP-14 Booster Display', category: 'One Piece Card Game', price: 44990, releaseDate: '2026. november 28.', stock: 30, isOpen: true, createdAt: new Date(Date.now() - 1000) },
  ]);

  // töltőképernyő az első betöltéskor
  const p = await page(b, null, 1280, 900, { intro: true });
  await p.goto(`${BASE}/weblapteszt`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await wait(300);
  const intro = await p.$eval('[data-toltokep]', el => ({ shown: getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0, text: el.textContent }));
  ok(intro.shown && MOOD.test(intro.text), `első betöltéskor töltőképernyő hangulatszöveggel (${intro.text.slice(0, 60)})`);
  await p.screenshot({ path: `${SHOTS}fooldal-tolto.jpg`, quality: 60 });
  await wait(700);
  ok(await p.$eval('[data-toltokep]', el => getComputedStyle(el).display !== 'none' && +getComputedStyle(el).opacity > 0.5), '1 mp után még olvasható');
  await wait(1700);
  const gone = await p.$eval('[data-toltokep]', el => ({ none: getComputedStyle(el).display === 'none', html: [...document.documentElement.attributes].map(a => `${a.name}=${a.value}`).join(' '), vis: getComputedStyle(el).visibility, op: getComputedStyle(el).opacity }));
  ok(gone.none, `~2 mp után eltűnik (${gone.html}; ${gone.vis} ${gone.op})`);
  await p.reload({ waitUntil: 'domcontentloaded' });
  await wait(200);
  ok(await p.$eval('[data-toltokep]', el => getComputedStyle(el).display === 'none'), 'újratöltéskor (ugyanabban a munkamenetben) már nem jön');
  await p.goto(`${BASE}/weblapteszt`, { waitUntil: 'networkidle2' });

  // sorrend
  const order = await p.evaluate((ids) => ids.map(id => { const el = document.getElementById(id); return el ? [...document.querySelectorAll('main section')].indexOf(el) : -1; }), ORDER);
  ok(order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])), `a szakaszok sorrendje: ${ORDER.join(', ')} (${order.join(', ')})`);
  ok(!(await p.$('#kinalat')), 'a régi nagy mondatok mezői eltűntek');
  const titles = await p.evaluate(() => ({ liga: document.getElementById('liga-cim')?.textContent, galeria: document.getElementById('galeria-cim')?.textContent, boltok: document.getElementById('boltok-cim')?.textContent }));
  ok(titles.liga === 'Ligák' && titles.galeria === 'Galéria' && titles.boltok === 'Itt találsz minket', `új címek (${Object.values(titles).join(' | ')})`);

  // Előrendelés sáv a cégér alatt
  const pre = await p.evaluate(() => {
    const sign = document.querySelector('[data-sign]').getBoundingClientRect();
    const bar = document.querySelector('[data-elorendeles-sav]');
    const r = bar.getBoundingClientRect();
    return { below: r.top >= sign.bottom - 1 && r.bottom <= innerHeight, anim: getComputedStyle(bar).animationName, text: bar.textContent };
  });
  ok(pre.below && /Mega Evolution/.test(pre.text), 'az Előrendelés sáv közvetlenül a cégér alatt, az első képernyőn');
  ok(/heroPreIn/.test(pre.anim), `finoman beúszik (${pre.anim})`);
  const all = await p.$eval('[data-osszes-elorendeles]', a => ({ h: a.getBoundingClientRect().height, href: a.getAttribute('href'), cal: a.hasAttribute('data-cal') }));
  ok((await p.$$('[data-elorendeles]')).length === 2 && all.h >= 44 && /\/elorendeles$/.test(all.href) && all.cal, 'több előrendelésnél is ott az „Összes előrendelés” gomb (44 px)');
  await wait(1900);
  await p.screenshot({ path: `${SHOTS}fooldal-hero.jpg`, quality: 60 });

  // a teljes naptár gombja
  const cta = await p.$eval('[data-teljes-naptar]', a => { const r = a.getBoundingClientRect(), h = document.getElementById('program-cim').getBoundingClientRect(); return { h: r.height, w: r.width, right: innerWidth - r.right, top: r.top < h.bottom && r.bottom > h.top, bg: getComputedStyle(a).backgroundColor, cal: a.hasAttribute('data-cal') }; });
  ok(cta.h >= 64 && cta.h < 100 && cta.w < 600 && cta.right < 60 && cta.top && cta.bg === 'rgb(229, 177, 93)' && cta.cal, `a teljes naptár gomb a blokk jobb felső sarkában, arany (${Math.round(cta.w)}×${Math.round(cta.h)})`);
  await p.$eval('#program', el => el.scrollIntoView({ block: 'start' }));
  await wait(400);
  await p.screenshot({ path: `${SHOTS}fooldal-naptar-gomb.jpg`, quality: 60 });

  // Hírek: minta Facebook- / Instagram-posztok (a behúzás még nincs beállítva)
  const posts = await p.$$eval('#hirek [data-poszt]', els => els.map(e => ({ src: e.dataset.poszt, pics: +e.dataset.kepek, text: e.textContent })));
  ok(posts.length === 6 && posts.every(x => /Minta/.test(x.text) && /30\. évfordulós/.test(x.text)), `6 minta poszt a 30. évfordulós ETB-kről (${posts.length})`);
  ok(posts.map(x => x.pics).join() === '0,1,0,1,5,4' && posts.some(x => x.src === 'instagram') && posts.some(x => x.src === 'facebook'), `kép nélkül, 1 képpel, sok képpel; Facebook és Instagram (${posts.map(x => x.pics).join()})`);
  ok(await p.$eval('#hirek [data-kepek="5"]', el => /\+1/.test(el.textContent)), 'sok képnél 4 látszik, az utolsón „+1”');
  await p.$eval('[data-kozossegi]', el => el.scrollIntoView({ block: 'start' }));
  await wait(600);
  await p.screenshot({ path: `${SHOTS}fooldal-hirek-minta.jpg`, quality: 60, fullPage: false });

  // boltok: fotó nélkül
  ok((await p.$$('#boltok a[data-map]')).length === 3 && !(await p.$('#boltok a[data-map] img')), 'a boltok soraiban nincs előnézeti fotó');

  // naptárablak: töltőképernyő hangulatszöveggel, legalább 1,2 mp
  await p.$eval('[data-teljes-naptar]', el => el.scrollIntoView({ block: 'center' }));
  await wait(300);
  const box = await (await p.$('[data-teljes-naptar]')).boundingBox();
  await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await wait(800);
  const ld = await p.evaluate(() => { const d = document.querySelector('[role="dialog"]:not([hidden])'); return { text: d?.querySelector('[data-toltes]')?.textContent || '', frame: d?.querySelector('iframe')?.style.opacity || '' }; });
  ok(MOOD.test(ld.text) && ld.frame !== '1', `a naptár töltése közben hangulatszöveg (${ld.text.slice(0, 50)})`);
  await p.screenshot({ path: `${SHOTS}fooldal-naptar-toltes.jpg`, quality: 60 });
  await p.waitForFunction(() => document.querySelector('[role="dialog"]:not([hidden]) iframe')?.style.opacity === '1', { timeout: 30000 }).catch(() => {});
  ok(await p.evaluate(() => document.querySelector('[role="dialog"]:not([hidden]) iframe')?.style.opacity === '1'), 'utána megjelenik a naptár');

  // telefon
  const ph = await page(b, null, 402, 874);
  await ph.goto(`${BASE}/weblapteszt`, { waitUntil: 'networkidle2' });
  ok((await ph.evaluate(() => document.documentElement.scrollWidth)) === 402, 'telefonon nincs vízszintes görgetés');
  const phPre = await ph.evaluate(() => { const r = document.querySelector('[data-elorendeles-sav]').getBoundingClientRect(); return r.bottom <= innerHeight; });
  ok(phPre, 'telefonon is az első képernyőn az Előrendelés sáv');
  await wait(1900);
  await ph.screenshot({ path: `${SHOTS}fooldal-hero-telefon.jpg`, quality: 60 });
  const phCta = await ph.$eval('[data-teljes-naptar]', a => { const r = a.getBoundingClientRect(); return { h: r.height, w: r.width }; });
  ok(phCta.h >= 64 && phCta.w >= 360, `telefonon a teljes naptár gomb teljes szélességű (${Math.round(phCta.w)}×${Math.round(phCta.h)})`);
  await ph.$eval('[data-kozossegi]', el => el.scrollIntoView({ block: 'start' }));
  await wait(500);
  await ph.screenshot({ path: `${SHOTS}fooldal-hirek-minta-telefon.jpg`, quality: 60 });
  await ph.$eval('[data-teljes-naptar]', el => el.scrollIntoView({ block: 'center' }));
  await wait(500);
  await ph.screenshot({ path: `${SHOTS}fooldal-naptar-gomb-telefon.jpg`, quality: 60 });
  await ph.$eval('#boltok', el => el.scrollIntoView({ block: 'start' }));
  await wait(500);
  await ph.screenshot({ path: `${SHOTS}fooldal-boltok-telefon.jpg`, quality: 60 });
  // a töltőképernyő telefonon
  const pt = await page(b, null, 402, 874, { intro: true });
  await pt.goto(`${BASE}/weblapteszt`, { waitUntil: 'domcontentloaded' });
  await wait(600);
  await pt.screenshot({ path: `${SHOTS}fooldal-tolto-telefon.jpg`, quality: 60 });
  ok(await pt.$eval('[data-toltokep]', el => el.getBoundingClientRect().width <= 402 && getComputedStyle(el).display !== 'none'), 'telefonon is a töltőképernyő');
  console.log('  böngészőhibák:', [...p.errs, ...ph.errs, ...pt.errs].join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
