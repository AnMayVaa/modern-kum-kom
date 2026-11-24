import type { Metadata } from 'next';
import Link from 'next/link';
import { RulesContent } from '@/components/RulesContent';
import { SiteCredit } from '@/components/SiteCredit';
import { Wordmark } from '@/components/ui/Tile';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'เกี่ยวกับและวิธีเล่น',
  description:
    'วิธีเล่นคำคม (Kum-Kom) เกมต่อคำภาษาไทยออนไลน์: กติกา ช่องคูณแต้ม สระและวรรณยุกต์ เบี้ยว่าง การเล่นกับบอทและกับเพื่อน พร้อมข้อมูลผู้พัฒนา',
  alternates: { canonical: '/about' },
  openGraph: { url: '/about', title: 'วิธีเล่นคำคม เกมต่อคำภาษาไทย', type: 'article' },
};

const FEATURES = [
  'กระดาน 15×15 พร้อมช่องคูณแต้ม 2L 3L 4L 2W 3W และช่องดาว',
  'สระบน สระล่าง และวรรณยุกต์ซ้อนกันได้แบบภาษาไทยจริง',
  'เห็นคำที่กำลังต่อและแต้มที่จะได้ทันทีก่อนกดลงคำ',
  'บอทสามระดับที่ค้นคำจากพจนานุกรมทั้งเล่ม พร้อมปุ่มคำใบ้',
  'เล่นออนไลน์กับเพื่อนด้วยรหัสห้องหรือลิงก์ หรือกดหาคู่แข่งทันที',
  'พจนานุกรม 25,551 คำ ค้นหาได้ในเกม',
  'บันทึกเกมที่เล่นค้างไว้และสถิติการเล่นในเครื่อง',
  'เล่นได้ทั้งบนมือถือและคอมพิวเตอร์ ไม่ต้องติดตั้งแอป',
];

const FAQ: { q: string; a: string }[] = [
  { q: 'คำคมคืออะไร', a: 'คำคม (Kum-Kom) คือเกมกระดานต่อคำภาษาไทย คล้ายสแครบเบิล (Scrabble) ผู้เล่นใช้เบี้ยตัวอักษรต่อคำบนกระดานเพื่อสะสมแต้ม' },
  { q: 'เล่นฟรีไหม ต้องสมัครสมาชิกหรือเปล่า', a: 'เล่นฟรีทั้งหมด แค่ใส่ชื่อที่จะแสดงในเกมก็เริ่มได้เลย จะเข้าสู่ระบบด้วย Google ก็ได้ถ้าต้องการ' },
  { q: 'เล่นกับเพื่อนอย่างไร', a: 'เลือก “เล่นออนไลน์กับเพื่อน” แล้วสร้างห้อง ส่งรหัสห้อง 6 หลักหรือลิงก์ห้องให้เพื่อน เมื่อทั้งสองคนกดพร้อมเล่น เกมจะเริ่มทันที' },
  { q: 'คำศัพท์มาจากไหน', a: 'พจนานุกรมในเกมมี 25,551 คำ มาจากฐานข้อมูลคำศัพท์ของเกมคำคมต้นฉบับ' },
  { q: 'เล่นบนมือถือได้ไหม', a: 'ได้ หน้าจอออกแบบให้ใช้บนมือถือเป็นหลัก และมีปุ่มขยายกระดานเมื่อต้องการดูใกล้ ๆ' },
];

export default function AboutPage() {
  const { author } = SITE;
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center px-5 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd).replace(/</g, '\\u003c') }} />
      <Link href="/" aria-label="กลับไปหน้าเล่นเกม">
        <Wordmark size={56} />
      </Link>

      <article className="mt-8 w-full rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <h1 className="font-display text-3xl font-bold leading-tight">คำคม เกมต่อคำภาษาไทยออนไลน์</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-kram-700">
          คำคม (Kum-Kom) คือเกมกระดานต่อคำภาษาไทยแบบเดียวกับสแครบเบิล เว็บนี้ทำให้เล่นได้ฟรีบนเบราว์เซอร์ ทั้งเล่นคนเดียวกับบอทและเล่นออนไลน์กับเพื่อน
          โดยตรวจคำจากพจนานุกรมภาษาไทย 25,551 คำ
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-kram-500" lang="en">
          {SITE.descriptionEn}
        </p>
        <Link href="/" className="mt-6 inline-block rounded-xl bg-kram-900 px-5 py-3 font-semibold text-ivory hover:bg-kram-800">
          เริ่มเล่นเลย
        </Link>

        <h2 className="mt-10 mb-4 font-display text-2xl font-bold">วิธีเล่น</h2>
        <RulesContent />

        <h2 className="mt-10 mb-3 font-display text-2xl font-bold">มีอะไรในเกมบ้าง</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-kram-700">
          {FEATURES.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>

        <h2 className="mt-10 mb-3 font-display text-2xl font-bold">คำถามที่พบบ่อย</h2>
        <dl className="flex flex-col gap-4">
          {FAQ.map(({ q, a }) => (
            <div key={q}>
              <dt className="font-semibold text-kram-900">{q}</dt>
              <dd className="mt-0.5 text-[15px] leading-relaxed text-kram-700">{a}</dd>
            </div>
          ))}
        </dl>

        <h2 className="mt-10 mb-3 font-display text-2xl font-bold">ผู้พัฒนา</h2>
        <div className="rounded-xl bg-kram-50 p-4 text-[15px] leading-relaxed text-kram-900">
          <p className="font-display text-xl font-bold">
            {author.nameTh} <span className="font-sans text-base font-medium text-kram-700">({author.nickname})</span>
          </p>
          <p className="text-kram-700" lang="en">
            {author.nameEn} ({author.nicknameEn})
          </p>
          <p className="mt-2 text-kram-700">{author.affiliationTh}</p>
          <ul className="mt-3 flex flex-col gap-1">
            <li>
              GitHub:{' '}
              <a href={author.github} rel="author" className="font-medium text-kram-900 underline underline-offset-2">
                github.com/{author.githubHandle}
              </a>
            </li>
            <li>
              ซอร์สโค้ด:{' '}
              <a href={SITE.repo} className="font-medium text-kram-900 underline underline-offset-2">
                github.com/AnMayVaa/modern-kum-kom
              </a>
            </li>
            {author.contactEmail && (
              <li>
                อีเมล:{' '}
                <a href={`mailto:${author.contactEmail}`} className="font-medium text-kram-900 underline underline-offset-2">
                  {author.contactEmail}
                </a>
              </li>
            )}
          </ul>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-kram-500">
          สร้างด้วย Next.js, React, TypeScript, Tailwind CSS และ Pusher พบปัญหาหรืออยากเสนอไอเดีย เปิด issue ได้ที่{' '}
          <a href={`${SITE.repo}/issues`} className="underline underline-offset-2">
            GitHub
          </a>
        </p>
      </article>

      <SiteCredit className="mt-8" />
    </main>
  );
}
