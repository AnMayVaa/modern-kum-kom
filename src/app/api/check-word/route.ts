import { NextResponse } from 'next/server';
import { isWord } from '@/lib/server/words';

// Fallback word check, used only if the browser couldn't download the word list.
// Accepts { word } or { words: [...] }.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { word?: unknown; words?: unknown };
  const list = Array.isArray(body.words) ? body.words : [body.word];
  const words = list.filter((w): w is string => typeof w === 'string' && w.length > 0 && w.length <= 60).slice(0, 50);
  if (words.length === 0) return NextResponse.json({ valid: false, results: {} }, { status: 400 });
  try {
    const checked = await Promise.all(words.map(async (w) => [w, await isWord(w)] as const));
    const results = Object.fromEntries(checked);
    return NextResponse.json({ valid: checked.every(([, ok]) => ok), results });
  } catch (error) {
    console.error('Word check failed', error);
    return NextResponse.json({ valid: false, error: 'ตรวจคำไม่สำเร็จ' }, { status: 503 });
  }
}
