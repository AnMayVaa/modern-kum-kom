// src/app/api/multiplayer/match/route.ts
import { NextResponse } from 'next/server';
import Pusher from 'pusher';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: "ap1",
  useTLS: true,
});

let waitingRoomId: string | null = null; // คิวสำหรับสุ่มห้อง

export async function POST(req: Request) {
  const { action, roomId, role, playerReady } = await req.json();

  // 1. ระบบสุ่มหาคู่ (Random Match)
  if (action === 'find_match') {
    if (waitingRoomId) {
      const id = waitingRoomId;
      waitingRoomId = null; 
      return NextResponse.json({ roomId: id, role: 2 }); // เราเป็นคนจอย
    } else {
      const id = `RANDOM_${Math.floor(1000 + Math.random() * 9000)}`;
      waitingRoomId = id;
      return NextResponse.json({ roomId: id, role: 1 }); // เราเป็นคนสร้าง
    }
  }

  // 2. ระบบทักทาย (Handshake): P2 บอก P1 ว่า "ฉันพร้อมรับข้อมูลแล้ว"
  if (action === 'notify_ready_to_pair') {
    const starter = Math.random() > 0.5 ? 1 : 2; // สุ่มคนเริ่มเกมที่นี่
    await pusher.trigger(`room-${roomId}`, 'match-connected', { starter });
    return NextResponse.json({ success: true, starter });
  }

  // 3. ระบบยืนยันความพร้อมเล่น (Ready Check)
  if (action === 'set_ready') {
    // ส่งสัญญาณบอก "ทุกคน" ในห้องว่าบทบาทนี้พร้อมแล้ว
    // ตัด socket_id ออกเพื่อให้สัญญาณส่งถึงทุกคนใน Channel ทันที
    await pusher.trigger(`room-${roomId}`, 'player-ready', { 
        role, 
        playerReady: true 
    });
    return NextResponse.json({ success: true });
    }

  // 4. ระบบแจ้งคนออกเกม
  if (action === 'player_left') {
    await pusher.trigger(`room-${roomId}`, 'opponent-disconnected', { role });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false });
}