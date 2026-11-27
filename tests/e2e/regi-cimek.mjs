// Régi címek: a weboldal régebben elmentett tartalmában és a hírekben a régi taverncalendar.vercel.app linkek az új
// címre mutatnak (a naptár gyökere a /naptar-ra, a többi ugyanazzal az úttal), a /weblapteszt címek átirányítanak.
import { openDb, browser, page, ok, summary, BASE } from './lib.mjs';

const { client, db } = await openDb();
await db.collection('website_content').updateOne({ _id: 'site' }, { $set: { general: { cta: { label: 'Naptár', href: 'https://taverncalendar.vercel.app' } } } }, { upsert: true });
// az éles oldal a kirakott hírek gyűjteményéből olvas (website_posts_live)
const postId = String((await db.collection('website_posts_live').insertOne({ title: 'Régi linkes hír', text: 'Nézd meg a ligát!', link: 'https://taverncalendar.vercel.app/liga', date: new Date(), published: true, createdAt: new Date() })).insertedId);

const b = await browser();
try {
  const p = await page(b, null);
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 240000 });
  const cta = await p.$eval('[data-teljes-naptar]', a => a.getAttribute('href')).catch(() => '');
  ok(cta === `${BASE}/naptar`, `a régi „Naptár” link (vercel.app gyökér) a /naptar-ra mutat (${cta})`);
  const html = await p.content();
  ok(!/taverncalendar\.vercel\.app/.test(html), 'a főoldalon sehol nincs régi vercel.app cím');
  const news = await (await fetch(`${BASE}/hirek/${postId}`)).text();
  ok(news.includes(`${BASE}/liga`) && !/taverncalendar\.vercel\.app/.test(news), 'a hír régi linkje („Részletek”) az új címre mutat, ugyanazzal az úttal');
  for (const [from, to] of [['/weblapteszt', '/'], ['/weblapteszt/hirek', '/hirek'], ['/weblapteszt/galeria', '/galeria']]) {
    const r = await fetch(`${BASE}${from}`, { redirect: 'manual' });
    ok(r.status === 308 && new URL(r.headers.get('location'), BASE).pathname === to, `${from} → ${to} (${r.status})`);
  }
  console.log('  böngészőhibák:', p.errs.join(' | ') || 'nincs');
} finally {
  await b.close(); await client.close(); summary();
}
