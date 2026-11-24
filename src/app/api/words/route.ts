import { NextResponse } from 'next/server';
import { loadWords } from '@/lib/server/words';

// The whole word list, downloaded once by the browser so word checks and the bot run locally.
export async function GET() {
  try {
    const words = await loadWords();
    return NextResponse.json(
      { count: words.length, words },
      { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' } },
    );
  } catch (error) {
    console.error('Loading the word list failed', error);
    return NextResponse.json({ error: 'โหลดพจนานุกรมไม่สำเร็จ' }, { status: 503 });
  }
}
