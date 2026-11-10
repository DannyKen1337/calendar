// Task 1: nincs több „Weblap jóváhagyó” jog; bármely Weblap mester az előnézetből rakja ki a módosításokat.
import { openDb, token, get, browser, page, bodyText, clickText, ok, summary, wait, SHOTS } from './lib.mjs';

const { client, db } = await openDb();
const ids = (await db.collection('users').insertMany([
  { username: 'Tulaj', email: 'o@x.hu', password: 'x', role: 'owner' },
  // régi fiók: még a megszűnt jog is nála van
  { username: 'Szerkeszto', email: 's@x.hu', password: 'x', role: 'admin', features: ['website', 'websitePublish'], allowedCategories: [], allowedStores: [] },
  { username: 'Uj', email: 'u@x.hu', password: 'x', role: 'admin', features: ['website'], allowedCategories: [], allowedStores: [] },
])).insertedIds;
await db.collection('user_groups').insertMany([
  { name: 'Weblap jóváhagyó', features: ['websitePublish'], allowedCategories: [], allowedStores: [] },
  { name: 'Vegyes', features: ['website', 'websitePublish'], allowedCategories: [], allowedStores: [] },
]);
await db.collection('settings').insertOne({ _id: 'default_groups_v1', at: new Date() });
const owner = await token(ids[0], 'Tulaj', 'owner');
const editor = await token(ids[2], 'Uj', 'admin');

const b = await browser();
try {
  const p = await page(b, editor);
  await p.goto(`http://localhost:3179/weblapteszt/admin`, { waitUntil: 'networkidle2', timeout: 240000 });
  await p.type('input[name=title]', 'Teszt hír');
  await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle2' }), clickText(p, 'button', 'Hír mentése az előnézetbe')]);
  const admin = await bodyText(p);
  ok(!/jóváhagy/i.test(admin), 'a szerkesztőfelületen nincs „jóváhagyó” szöveg');

  await p.goto(`http://localhost:3179/weblapteszt/elonezet`, { waitUntil: 'networkidle2' });
  const bar = await p.evaluate(() => document.querySelector('[aria-label="Előnézet"]')?.innerText || '');
  ok(bar.includes('Kirakás az éles oldalra'), 'jogos szerkesztő: kirakás gomb az előnézet sávjában');
  ok(bar.includes('Elvetés'), 'jogos szerkesztő: elvetés gomb az előnézet sávjában');
  await p.screenshot({ path: `${SHOTS}t1-elonezet.jpg`, quality: 60 });
  await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle2' }), clickText(p, '[aria-label="Előnézet"] button', 'Kirakás az éles oldalra')]);
  const live = await (await get('/weblapteszt')).text();
  ok(live.includes('Teszt hír'), 'kirakás után az éles oldalon a hír');

  // a csoportok: a megszűnt jog eltűnik (a Felhasználók oldal betöltése futtatja az alapcsoportokat)
  await get('/api/admin-users', owner);
  const groups = await db.collection('user_groups').find().toArray();
  ok(!groups.some(g => g.name === 'Weblap jóváhagyó'), 'a „Weblap jóváhagyó” csoport törölve');
  ok(groups.find(g => g.name === 'Vegyes')?.features.join() === 'website', 'vegyes csoportból csak a megszűnt jog kerül ki');
  const old = await db.collection('users').findOne({ username: 'Szerkeszto' });
  ok(old.features.join() === 'website', 'a felhasználóktól is kikerül');
  console.log('  böngészőhibák:', p.errs.join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
