import { NextResponse } from 'next/server';
import { claimQuickRoom, closeRoom, createRoom, getRoom, isRoomCode, joinRoom, keepRoomAlive } from '@/lib/server/rooms';
import { getPusher, triggerRoom } from '@/lib/server/pusher';

const cleanName = (name: unknown) => (typeof name === 'string' && name.trim() ? name.trim().slice(0, 24) : 'ผู้เล่น');

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { action?: string; name?: unknown; roomId?: unknown };
  const name = cleanName(body.name);

  try {
    switch (body.action) {
      case 'create':
      case 'quick':
      case 'join': {
        if (!getPusher()) return NextResponse.json({ error: 'ระบบเล่นออนไลน์ยังไม่ได้ตั้งค่าบนเซิร์ฟเวอร์' }, { status: 503 });
        if (body.action === 'create') {
          const room = await createRoom('private', name);
          return NextResponse.json({ roomId: room._id, role: 1 });
        }
        if (body.action === 'quick') {
          const open = await claimQuickRoom(name);
          if (open) {
            await triggerRoom(open._id, 'opponent-joined', { role: 2, name });
            return NextResponse.json({ roomId: open._id, role: 2, opponentName: open.hostName });
          }
          const room = await createRoom('quick', name);
          return NextResponse.json({ roomId: room._id, role: 1 });
        }
        if (!isRoomCode(body.roomId)) return NextResponse.json({ error: 'รหัสห้องต้องเป็นตัวเลข 6 หลัก' }, { status: 400 });
        const { room, error } = await joinRoom(body.roomId, name);
        if (!room) return NextResponse.json({ error }, { status: 404 });
        await triggerRoom(room._id, 'opponent-joined', { role: 2, name });
        return NextResponse.json({ roomId: room._id, role: 2, opponentName: room.hostName });
      }
      case 'status': {
        if (!isRoomCode(body.roomId)) return NextResponse.json({ error: 'รหัสห้องไม่ถูกต้อง' }, { status: 400 });
        const room = await getRoom(body.roomId);
        return NextResponse.json(room ? { status: room.status, hostName: room.hostName, guestName: room.guestName ?? null } : { status: 'missing' });
      }
      case 'keepalive':
      case 'close': {
        if (!isRoomCode(body.roomId)) return NextResponse.json({ error: 'รหัสห้องไม่ถูกต้อง' }, { status: 400 });
        await (body.action === 'close' ? closeRoom(body.roomId) : keepRoomAlive(body.roomId));
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Room request failed', error);
    return NextResponse.json({ error: 'เชื่อมต่อห้องไม่สำเร็จ ลองอีกครั้ง' }, { status: 500 });
  }
}
