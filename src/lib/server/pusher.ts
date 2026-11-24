import Pusher from 'pusher';

let instance: Pusher | null | undefined;

/** Server-side Pusher client, or null when the Pusher keys aren't configured. */
export function getPusher(): Pusher | null {
  if (instance !== undefined) return instance;
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  if (!appId || !key || !secret) return (instance = null);
  const host = process.env.PUSHER_HOST; // set only when using a local Pusher-compatible server such as soketi
  instance = new Pusher({
    appId,
    key,
    secret,
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap1',
    useTLS: process.env.PUSHER_USE_TLS !== 'false',
    ...(host ? { host, port: process.env.PUSHER_PORT } : {}),
  });
  return instance;
}

export const roomChannel = (roomId: string) => `room-${roomId}`;

export async function triggerRoom(roomId: string, event: string, data: unknown): Promise<boolean> {
  const pusher = getPusher();
  if (!pusher) return false;
  await pusher.trigger(roomChannel(roomId), event, data);
  return true;
}
