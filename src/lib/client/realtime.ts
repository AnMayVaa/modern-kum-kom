'use client';

import Pusher from 'pusher-js';
import type { PlayerId } from '@/lib/game/state';

const KEY = process.env.NEXT_PUBLIC_PUSHER_KEY;
const CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap1';
const HOST = process.env.NEXT_PUBLIC_PUSHER_HOST; // only for a local Pusher-compatible server (soketi)
const PORT = Number(process.env.NEXT_PUBLIC_PUSHER_PORT || 6001);

let client: Pusher | null = null;

export const realtimeAvailable = () => !!KEY;

/** One Pusher connection for the whole app. */
export function getPusher(): Pusher | null {
  if (!KEY) return null;
  client ??= new Pusher(KEY, {
    cluster: CLUSTER,
    ...(HOST ? { wsHost: HOST, wsPort: PORT, wssPort: PORT, forceTLS: false, enabledTransports: ['ws', 'wss'] } : {}),
  });
  return client;
}

export const roomChannel = (roomId: string) => `room-${roomId}`;

export type RoomEvent = 'hello' | 'ready' | 'state' | 'leave' | 'reaction' | 'rematch';

export async function sendRoomEvent(roomId: string, role: PlayerId, type: RoomEvent, payload: object = {}): Promise<boolean> {
  try {
    const res = await fetch('/api/multiplayer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, role, type, payload }),
      keepalive: type === 'leave',
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Best-effort "I left" signal that still gets sent while the tab is closing. */
export function beaconLeave(roomId: string, role: PlayerId) {
  const body = JSON.stringify({ roomId, role, type: 'leave', payload: {} });
  if (!navigator.sendBeacon?.('/api/multiplayer', new Blob([body], { type: 'application/json' }))) {
    void sendRoomEvent(roomId, role, 'leave');
  }
}

export async function roomRequest<T>(action: string, data: object = {}): Promise<T & { error?: string }> {
  const res = await fetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...data }),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok && !json.error) json.error = 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ';
  return json;
}
