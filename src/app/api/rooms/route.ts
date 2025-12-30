// src/app/api/rooms/route.ts
import { NextResponse } from 'next/server';

// ใช้ Set เก็บ roomId ที่ "กำลังใช้งาน"
let activeRooms = new Set<string>();

export async function POST(req: Request) {
  const { action, roomId } = await req.json();

  if (action === 'create') {
    activeRooms.add(roomId);
    return NextResponse.json({ success: true });
  }

  if (action === 'check') {
    // ตรวจสอบว่าห้องมีอยู่จริงไหม
    return NextResponse.json({ exists: activeRooms.has(roomId) });
  }

  if (action === 'delete') {
    activeRooms.delete(roomId); // ลบห้องทิ้งเมื่อเกมจบหรือคนออก
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false });
}