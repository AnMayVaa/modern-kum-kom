// Room and matchmaking storage. Serverless functions don't keep memory between
// requests, so rooms live in MongoDB; without a database (local dev) a process-wide Map
// is used instead.

import { Collection } from 'mongodb';
import { getDb } from './mongo';

export type RoomKind = 'private' | 'quick';

export interface Room {
  _id: string;
  kind: RoomKind;
  status: 'waiting' | 'full' | 'closed';
  hostName: string;
  guestName?: string;
  createdAt: Date;
  /** A waiting room is only offered to others while its host keeps it alive. */
  waitingUntil: Date;
  /** MongoDB deletes the room after this time (TTL index). */
  expireAt: Date;
}

const WAIT_MS: Record<RoomKind, number> = { quick: 45_000, private: 30 * 60_000 };
const LIFETIME_MS = 12 * 60 * 60_000;

export const isRoomCode = (code: unknown): code is string => typeof code === 'string' && /^\d{6}$/.test(code);
const newCode = () => String(Math.floor(100000 + Math.random() * 900000));

interface Store {
  insert(room: Room): Promise<boolean>;
  get(code: string): Promise<Room | null>;
  claim(filter: { code?: string; kind: RoomKind }, guestName: string): Promise<Room | null>;
  update(code: string, set: Partial<Room>): Promise<void>;
}

const memory = globalThis as typeof globalThis & { __kumkomRooms?: Map<string, Room> };
const memoryStore = (): Store => {
  const rooms = (memory.__kumkomRooms ??= new Map());
  return {
    async insert(room) {
      if (rooms.has(room._id)) return false;
      rooms.set(room._id, room);
      return true;
    },
    async get(code) {
      return rooms.get(code) ?? null;
    },
    async claim({ code, kind }, guestName) {
      const now = Date.now();
      const open = [...rooms.values()]
        .filter((r) => r.kind === kind && r.status === 'waiting' && r.waitingUntil.getTime() > now && (!code || r._id === code))
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
      if (!open) return null;
      Object.assign(open, { status: 'full', guestName });
      return open;
    },
    async update(code, set) {
      const room = rooms.get(code);
      if (room) Object.assign(room, set);
    },
  };
};

let indexesReady: Promise<unknown> | null = null;
const mongoStore = (rooms: Collection<Room>): Store => {
  indexesReady ??= Promise.all([
    rooms.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }),
    rooms.createIndex({ kind: 1, status: 1, waitingUntil: 1 }),
  ]).catch(() => null);
  return {
    async insert(room) {
      try {
        await rooms.insertOne(room);
        return true;
      } catch (error) {
        if ((error as { code?: number }).code === 11000) return false;
        throw error;
      }
    },
    get: (code) => rooms.findOne({ _id: code }),
    claim: ({ code, kind }, guestName) =>
      rooms.findOneAndUpdate(
        { ...(code ? { _id: code } : {}), kind, status: 'waiting', waitingUntil: { $gt: new Date() } },
        { $set: { status: 'full', guestName } },
        { sort: { createdAt: 1 }, returnDocument: 'after' },
      ),
    async update(code, set) {
      await rooms.updateOne({ _id: code }, { $set: set });
    },
  };
};

async function store(): Promise<Store> {
  const db = await getDb();
  return db ? mongoStore(db.collection<Room>('rooms')) : memoryStore();
}

export async function createRoom(kind: RoomKind, hostName: string): Promise<Room> {
  const s = await store();
  const now = Date.now();
  for (let attempt = 0; attempt < 8; attempt++) {
    const room: Room = {
      _id: newCode(),
      kind,
      status: 'waiting',
      hostName,
      createdAt: new Date(now),
      waitingUntil: new Date(now + WAIT_MS[kind]),
      expireAt: new Date(now + LIFETIME_MS),
    };
    if (await s.insert(room)) return room;
  }
  throw new Error('Could not allocate a room code');
}

export async function joinRoom(code: string, guestName: string): Promise<{ room?: Room; error?: string }> {
  const s = await store();
  const room = await s.claim({ code, kind: 'private' }, guestName);
  if (room) return { room };
  const existing = await s.get(code);
  if (existing?.status === 'full') return { error: 'ห้องนี้มีผู้เล่นครบสองคนแล้ว' };
  return { error: 'ไม่พบห้องนี้ หรือห้องปิดไปแล้ว' };
}

export async function claimQuickRoom(guestName: string): Promise<Room | null> {
  return (await store()).claim({ kind: 'quick' }, guestName);
}

export async function getRoom(code: string): Promise<Room | null> {
  return (await store()).get(code);
}

export async function keepRoomAlive(code: string): Promise<void> {
  const s = await store();
  const room = await s.get(code);
  if (room?.status === 'waiting') await s.update(code, { waitingUntil: new Date(Date.now() + WAIT_MS[room.kind]) });
}

export async function closeRoom(code: string): Promise<void> {
  await (await store()).update(code, { status: 'closed', waitingUntil: new Date(0) });
}
