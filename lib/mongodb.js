import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error('Please add your Mongo URI to .env.local');
}

let client;
let clientPromise;

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri);
  clientPromise = client.connect();
}

let tavernIndexesEnsured = false;

// Ugyanarra az eseményre egy e-mail címmel csak egyszer lehessen jelentkezni (dupla kattintás / párhuzamos kérés ellen is).
// Részleges index: csak a kitöltött e-mail címekre vonatkozik, mert az admin által hozzáadott (helyszíni) versenyzőknek
// nem kötelező e-mail cím, és több e-mail nélküli jelentkező nem ütközhet egymással.
// A korábbi, nem részleges indexet egyszer lecseréljük. Ha a meglévő adatokban duplikáció van, az index nem jön létre –
// ilyenkor a kódbeli ellenőrzés marad.
async function ensureRegistrationEmailIndex(db) {
  const coll = db.collection('registrations');
  const name = 'tournamentId_1_email_1';
  const existing = (await coll.indexes().catch(() => [])).find(i => i.name === name);
  if (existing && !existing.partialFilterExpression) await coll.dropIndex(name);
  if (!existing || !existing.partialFilterExpression) {
    await coll.createIndex({ tournamentId: 1, email: 1 }, { name, unique: true, partialFilterExpression: { email: { $type: 'string' } } });
  }
}

// Segédfüggvény, ami fixen a Tavern adatbázist adja vissza
export async function getTavernDb() {
  const client = await clientPromise;
  const db = client.db('Tavern');

  if (!tavernIndexesEnsured) {
    tavernIndexesEnsured = true;
    db.collection('rate_limits')
      .createIndex({ at: 1 }, { expireAfterSeconds: 86400 })
      .catch(() => {});
    ensureRegistrationEmailIndex(db).catch(() => {});
    // Megjelenési előzmények (check-in): jelentkezésenként egy bejegyzés, e-mail szerint összesítve
    db.collection('attendance_history').createIndex({ registrationId: 1 }, { unique: true }).catch(() => {});
    db.collection('attendance_history').createIndex({ email: 1 }).catch(() => {});
  }

  return db;
}

export default clientPromise;