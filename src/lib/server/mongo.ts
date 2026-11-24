import { Db, MongoClient } from 'mongodb';

const DB_NAME = process.env.MONGODB_DB || 'kumkom_db';
const RETRY_AFTER_MS = 60_000;

// One client per server process, reused across requests and hot reloads.
const cache = globalThis as typeof globalThis & { __kumkomMongo?: Promise<MongoClient>; __kumkomMongoFailedAt?: number };

/** True when a database is configured, whether or not it is reachable right now. */
export const hasDatabase = () => !!process.env.MONGODB_URI;

/**
 * The app database, or null when MONGODB_URI isn't set (local development without a database).
 * Throws if the database can't be reached; after a failure it waits a minute before trying again
 * so requests don't each wait for a dead server.
 */
export async function getDb(): Promise<Db | null> {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  if (cache.__kumkomMongoFailedAt && Date.now() - cache.__kumkomMongoFailedAt < RETRY_AFTER_MS) {
    throw new Error('MongoDB was unreachable a moment ago');
  }
  if (!cache.__kumkomMongo) {
    cache.__kumkomMongo = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 })
      .connect()
      .catch((error) => {
        cache.__kumkomMongo = undefined;
        cache.__kumkomMongoFailedAt = Date.now();
        throw error;
      });
  }
  return (await cache.__kumkomMongo).db(DB_NAME);
}
