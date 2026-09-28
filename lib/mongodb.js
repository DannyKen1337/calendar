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

// Segédfüggvény, ami fixen a Tavern adatbázist adja vissza
export async function getTavernDb() {
  const client = await clientPromise;
  const db = client.db('Tavern');

  if (!tavernIndexesEnsured) {
    tavernIndexesEnsured = true;
    db.collection('rate_limits')
      .createIndex({ at: 1 }, { expireAfterSeconds: 86400 })
      .catch(() => {});
  }

  return db;
}

export default clientPromise;