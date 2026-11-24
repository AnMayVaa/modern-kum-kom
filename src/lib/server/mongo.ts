import { Db, MongoClient } from 'mongodb';

const DB_NAME = process.env.MONGODB_DB || 'kumkom_db';

// One client per server process, reused across requests and hot reloads.
const cache = globalThis as typeof globalThis & { __kumkomMongo?: Promise<MongoClient> };

/** The app database, or null when MONGODB_URI isn't set (local development without a database). */
export async function getDb(): Promise<Db | null> {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  if (!cache.__kumkomMongo) {
    cache.__kumkomMongo = new MongoClient(uri).connect().catch((error) => {
      cache.__kumkomMongo = undefined;
      throw error;
    });
  }
  return (await cache.__kumkomMongo).db(DB_NAME);
}
