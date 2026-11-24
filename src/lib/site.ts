// Site identity used for metadata, structured data, the about page and the credits.

export const SITE = {
  url: (process.env.NEXT_PUBLIC_SITE_URL || 'https://modern-kum-kom.vercel.app').replace(/\/$/, ''),
  name: 'คำคม (Kum-Kom)',
  title: 'คำคม — เกมต่อคำภาษาไทยออนไลน์ | Kum-Kom Thai Crossword Game',
  shortTitle: 'คำคม เกมต่อคำภาษาไทย',
  description:
    'เล่นคำคม (Kum-Kom) เกมต่อคำภาษาไทยบนกระดาน 15×15 ฟรีบนเว็บ แข่งกับบอทสามระดับหรือชวนเพื่อนเล่นออนไลน์ ตรวจคำจากพจนานุกรม 25,551 คำ รองรับสระ วรรณยุกต์ เบี้ยว่าง และช่องคูณแต้ม',
  descriptionEn:
    'Play Kum-Kom (คำคม), the Thai-language crossword board game like Scrabble, free in the browser: against a bot with three levels or online with a friend, with a 25,551-word Thai dictionary.',
  keywords: [
    'คำคม',
    'เกมคำคม',
    'คำคมออนไลน์',
    'เกมต่อคำ',
    'เกมต่อคำภาษาไทย',
    'เกมต่ออักษร',
    'ครอสเวิร์ดภาษาไทย',
    'สแครบเบิลภาษาไทย',
    'เกมภาษาไทย',
    'เกมกระดาน',
    'Kum-Kom',
    'Kumkom',
    'Thai Scrabble',
    'Thai crossword game',
    'Thai word game',
  ],
  repo: 'https://github.com/AnMayVaa/modern-kum-kom',
  author: {
    nameTh: 'พิทักษ์ ปทุมวัน',
    nameEn: 'Pitak Patumwan',
    nickname: 'โอม',
    nicknameEn: 'Ohm',
    github: 'https://github.com/AnMayVaa',
    githubHandle: 'AnMayVaa',
    affiliationTh: 'วิศวกรรมคอมพิวเตอร์ มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าพระนครเหนือ (KMUTNB)',
    affiliationEn: 'Computer Engineering, King Mongkut’s University of Technology North Bangkok (KMUTNB)',
    /** Optional public contact address, set in the hosting environment. */
    contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || null,
  },
} as const;

/** schema.org data so search engines and AI assistants know what the site is and who made it. */
export function structuredData() {
  const { author } = SITE;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE.url}/#website`,
        url: SITE.url,
        name: SITE.name,
        description: SITE.description,
        inLanguage: 'th',
        author: { '@id': `${SITE.url}/#author` },
      },
      {
        '@type': ['VideoGame', 'WebApplication'],
        '@id': `${SITE.url}/#game`,
        name: SITE.name,
        alternateName: ['คำคม', 'Kum-Kom', 'Modern Kum-Kom', 'Thai Scrabble'],
        url: SITE.url,
        description: SITE.description,
        inLanguage: 'th',
        genre: ['Word game', 'Board game', 'Crossword'],
        gamePlatform: 'Web browser',
        applicationCategory: 'GameApplication',
        operatingSystem: 'Any (web browser)',
        playMode: ['SinglePlayer', 'MultiPlayer'],
        numberOfPlayers: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 2 },
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'THB' },
        image: `${SITE.url}/opengraph-image.png`,
        author: { '@id': `${SITE.url}/#author` },
        creator: { '@id': `${SITE.url}/#author` },
        codeRepository: SITE.repo,
      },
      {
        '@type': 'Person',
        '@id': `${SITE.url}/#author`,
        name: author.nameEn,
        alternateName: [author.nameTh, `${author.nicknameEn} Patumwan`, author.githubHandle],
        url: author.github,
        sameAs: [author.github],
        ...(author.contactEmail ? { email: `mailto:${author.contactEmail}` } : {}),
        affiliation: { '@type': 'CollegeOrUniversity', name: 'King Mongkut’s University of Technology North Bangkok' },
      },
    ],
  };
}
