import { NextResponse } from 'next/server';
import Pusher from 'pusher';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: "ap1",
  useTLS: true,
});

export async function POST(req: Request) {
  const data = await req.json();
  
  // ตะโกนบอกทุกคนในห้อง (ยกเว้นคนส่ง)
  await pusher.trigger(`room-${data.roomId}`, "move-made", {
    newGrid: data.newGrid,
    newScores: data.newScores,
    senderRole: data.senderRole,
    words: data.words,
    nextTurn: data.senderRole === 1 ? 2 : 1
  });

  return NextResponse.json({ success: true });
}