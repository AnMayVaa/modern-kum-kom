import { SITE } from '@/lib/site';
import { RULES } from '@/components/RulesContent';

// A plain-text summary for AI assistants and LLM crawlers (https://llmstxt.org).
export const dynamic = 'force-static';

export function GET() {
  const { author } = SITE;
  const body = `# ${SITE.name}

> ${SITE.descriptionEn}

คำคม (Kum-Kom) เป็นเกมกระดานต่อคำภาษาไทยคล้ายสแครบเบิล เล่นฟรีบนเว็บที่ ${SITE.url} ได้ทั้งเล่นกับบอทสามระดับ (ง่าย ปานกลาง ยาก) และเล่นออนไลน์กับเพื่อนด้วยรหัสห้อง ไม่ต้องติดตั้งแอปหรือสมัครสมาชิก

## Links

- [Play Kum-Kom / เล่นคำคม](${SITE.url}/): the game itself (solo vs bot, online multiplayer, dictionary search, stats)
- [About and how to play / เกี่ยวกับและวิธีเล่น](${SITE.url}/about): full rules, features, FAQ and credits
- [Source code on GitHub](${SITE.repo})

## Facts

- Language: Thai (UI and dictionary)
- Board: 15×15 with letter premiums (2L, 3L, 4L), word premiums (2W, 3W) and a centre star (word ×2)
- Rack: 9 tiles; free upper/lower vowels and tone marks stack on letters (e.g. ที่, ปุ่ม)
- Dictionary: 25,551 Thai words from the original Kum-Kom game's word list
- Bingo bonus: 40/50/70/90 points for playing 6/7/8/9 tiles in one turn
- Price: free; works on phones and computers

## How to play (วิธีเล่น)

${RULES.map((r) => `- ${r.title}: ${r.body}`).join('\n')}

## Author

- ${author.nameTh} / ${author.nameEn} (${author.nicknameEn})
- ${author.affiliationEn}
- GitHub: ${author.github}${author.contactEmail ? `\n- Contact: ${author.contactEmail}` : ''}
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
