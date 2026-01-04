import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

// ⚠️ เช็ค Connection String ใน .env.local ให้ถูกต้อง
const uri = process.env.MONGODB_URI!;
const client = new MongoClient(uri);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ words: [] });
  }

  try {
    await client.connect();
    const database = client.db('kumkom_db'); // ⚠️ ตรวจสอบชื่อ Database ของคุณ
    const collection = database.collection('vocabulary'); // ⚠️ ตรวจสอบชื่อ Collection คำศัพท์ของคุณ

    // ค้นหาคำที่ "ขึ้นต้นด้วย" query (Case insensitive)
    // และจำกัดผลลัพธ์แค่ 50 คำเพื่อไม่ให้โหลดหนักเกินไป
    const words = await collection
      .find({ word: { $regex: `^${query}`, $options: 'i' } }) 
      .limit(50)
      .toArray();

    return NextResponse.json({ words });
  } catch (error) {
    console.error("Dictionary Error:", error);
    return NextResponse.json({ error: "Failed to fetch words" }, { status: 500 });
  } finally {
    // ใน Next.js Serverless อาจจะไม่ต้อง close client บ่อยๆ แต่ใส่ไว้เพื่อความปลอดภัยในบาง env
    // await client.close(); 
  }
}