import Link from 'next/link';
import { SITE } from '@/lib/site';

/** Credits shown under the menu and on the about page. */
export function SiteCredit({ className = '' }: { className?: string }) {
  const { author } = SITE;
  const link = 'font-medium text-kram-700 underline-offset-2 hover:text-kram-950 hover:underline';
  return (
    <footer className={`w-full max-w-sm text-center text-[13px] leading-relaxed text-kram-500 ${className}`}>
      <p>
        พัฒนาโดย{' '}
        <a href={author.github} className={link} rel="author">
          {author.nameTh} ({author.nickname})
        </a>
      </p>
      <p className="mt-1.5 flex flex-wrap justify-center gap-x-4 gap-y-1">
        <Link href="/about" className={link}>
          เกี่ยวกับและวิธีเล่น
        </Link>
        <a href={SITE.repo} className={link}>
          ซอร์สโค้ด
        </a>
        {author.contactEmail && (
          <a href={`mailto:${author.contactEmail}`} className={link}>
            ติดต่อ
          </a>
        )}
      </p>
    </footer>
  );
}
