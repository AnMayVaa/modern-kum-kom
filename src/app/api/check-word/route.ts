import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function POST(req: Request) {
  try {
    const { word } = await req.json();
    const client = await clientPromise;
    const db = client.db("kumkom_db");
    const collection = db.collection("vocabulary");

    const result = await collection.findOne({ word: word });

    return NextResponse.json({ valid: !!result }); // ส่ง { valid: true/false } เสมอ
  } catch (error) {
    console.error(error);
    return NextResponse.json({ valid: false, error: "Internal Server Error" }, { status: 500 });
  }
}