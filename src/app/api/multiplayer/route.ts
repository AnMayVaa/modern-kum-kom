import { NextResponse } from 'next/server';
import { closeRoom, isRoomCode } from '@/lib/server/rooms';
import { triggerRoom } from '@/lib/server/pusher';

// Relays one game event to everyone in a room through Pusher.
const EVENTS = new Set(['hello', 'ready', 'state', 'leave', 'reaction', 'rematch']);
const MAX_BYTES = 9_000; // Pusher rejects messages over 10 KB

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { roomId?: unknown; role?: unknown; type?: unknown; payload?: unknown } | null;
  if (!body || !isRoomCode(body.roomId) || (body.role !== 1 && body.role !== 2) || typeof body.type !== 'string' || !EVENTS.has(body.type)) {
    return NextResponse.json({ error: 'Bad event' }, { status: 400 });
  }
  const payload = body.payload && typeof body.payload === 'object' ? body.payload : {};
  const data = { ...payload, role: body.role };
  if (Buffer.byteLength(JSON.stringify(data)) > MAX_BYTES) return NextResponse.json({ error: 'Event too large' }, { status: 413 });

  try {
    if (body.type === 'leave') await closeRoom(body.roomId);
    const sent = await triggerRoom(body.roomId, body.type, data);
    return NextResponse.json({ ok: sent }, { status: sent ? 200 : 503 });
  } catch (error) {
    console.error('Relaying a game event failed', error);
    return NextResponse.json({ error: 'ส่งข้อมูลไม่สำเร็จ' }, { status: 502 });
  }
}
