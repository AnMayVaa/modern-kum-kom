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

let waitingRoomId: string | null = null; 
let pendingHostNames: Record<string, string> = {}; // เก็บชื่อ P1 ไว้รอส่งให้ P2

export async function POST(req: Request) {
  const body = await req.json();
  // 💡 ดึง 'name' ออกมาจาก body เพื่อใช้เก็บชื่อผู้เล่น
  const { action, roomId, role, name, gameData } = body;

  // --- 1. ระบบสุ่มหาคู่ (Random Match) ---
  if (action === 'find_match') {
    if (waitingRoomId) {
      const id = waitingRoomId;
      waitingRoomId = null;
      const hostName = pendingHostNames[id]; // ดึงชื่อ P1 ที่รออยู่
      delete pendingHostNames[id];
      
      // P2 (คนจอย) จะได้รับชื่อ P1 (hostName) ทันทีจาก Response นี้
      return NextResponse.json({ roomId: id, role: 2, opponentName: hostName });
    } else {
      const id = `RANDOM_${Math.floor(1000 + Math.random() * 9000)}`;
      waitingRoomId = id;
      pendingHostNames[id] = name; // ✅ เก็บชื่อ P1 ไว้ใน Record
      return NextResponse.json({ roomId: id, role: 1 });
    }
  }

  // --- 2. ระบบทักทาย (Handshake) ---
  if (action === 'notify_ready_to_pair') {
    const starter = Math.random() > 0.5 ? 1 : 2;
    // 💡 ส่งชื่อ P2 ไปให้ P1 ผ่าน Pusher ทันทีที่เชื่อมต่อ
    await pusher.trigger(`room-${roomId}`, 'match-connected', { 
      starter, 
      opponentName: name // ส่งชื่อ P2 ไปให้ P1
    });
    return NextResponse.json({ success: true, starter });
  }

  // --- 3. ระบบกระจายการเดินเกม ---
  if (action === 'update_game') {
    await pusher.trigger(`room-${roomId}`, 'game-updated', {
      role,
      gameData 
    });
    return NextResponse.json({ success: true });
  }

  // --- 4. ระบบยืนยันความพร้อมใน Lobby (Ready Check) ---
  if (action === 'set_ready') {
    await pusher.trigger(`room-${roomId}`, 'player-ready', { 
        role, 
        playerReady: true,
        name: name,
        gameSetup: body.gameSetup 
    });
    return NextResponse.json({ success: true });
  }

  // --- 5. ระบบแจ้งคนออกเกม ---
  if (action === 'player_left' || action === 'leave_room') {
    await pusher.trigger(`room-${roomId}`, 'opponent-disconnected', { role });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: true });
}