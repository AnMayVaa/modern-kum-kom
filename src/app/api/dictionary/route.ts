import { NextResponse } from 'next/server';
import { loadWords } from '@/lib/server/words';
import { normalizeThai } from '@/lib/game/thai';

// Word search: words starting with q first, then words containing it (max 50).
export async function GET(request: Request) {
  const q = normalizeThai((new URL(request.url).searchParams.get('q') ?? '').trim()).slice(0, 40);
  if (!q) return NextResponse.json({ words: [] });
  try {
    const all = await loadWords();
    const starts = all.filter((w) => w.startsWith(q));
    const contains = starts.length < 50 ? all.filter((w) => !w.startsWith(q) && w.includes(q)) : [];
    const words = [...starts, ...contains].slice(0, 50).map((word) => ({ word }));
    return NextResponse.json({ words });
  } catch (error) {
    console.error('Dictionary search failed', error);
    return NextResponse.json({ error: 'ค้นหาคำไม่สำเร็จ' }, { status: 503 });
  }
}
