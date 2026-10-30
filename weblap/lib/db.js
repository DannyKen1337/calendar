// A weboldal ugyanazt a MongoDB-kapcsolatot és "Tavern" adatbázist használja, mint a naptár (lib/mongodb.js).
// A weboldal saját gyűjteményei:
//  - website_posts: a kézzel kirakott hírek
//  - website_post_flags: a Facebookról / Instagramról behúzott posztok elrejtése, kiemelése
// Csak szerveroldalon használható.
import 'server-only';

let indexesEnsured = false;

export async function getTavernDb() {
  // Csak itt töltjük be: a lib/mongodb.js betöltéskor hibát dob, ha nincs MONGODB_URI, a nyilvános oldalak pedig nélküle is mennek
  const { getTavernDb: calendarDb } = await import('@/lib/mongodb');
  const db = await calendarDb();
  if (!indexesEnsured) {
    indexesEnsured = true;
    db.collection('website_posts').createIndex({ published: 1, date: -1 }).catch(() => {});
  }
  return db;
}

export const hasDatabase = () => !!process.env.MONGODB_URI;
