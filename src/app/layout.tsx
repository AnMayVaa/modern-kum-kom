import type { Metadata, Viewport } from 'next';
import '@fontsource/anuphan/400.css';
import '@fontsource/anuphan/500.css';
import '@fontsource/anuphan/600.css';
import '@fontsource/trirong/500.css';
import '@fontsource/trirong/600.css';
import '@fontsource/trirong/700.css';
import './globals.css';
import { NextAuthProvider } from '@/components/Providers/NextAuthProvider';
import { ToastProvider } from '@/components/ui/Toast';
import { SITE, structuredData } from '@/lib/site';

const authorName = `${SITE.author.nameTh} (${SITE.author.nameEn})`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.title, template: '%s | คำคม Kum-Kom' },
  description: SITE.description,
  keywords: [...SITE.keywords],
  applicationName: 'คำคม',
  authors: [{ name: authorName, url: SITE.author.github }],
  creator: authorName,
  publisher: authorName,
  category: 'game',
  alternates: { canonical: '/', types: { 'text/plain': '/llms.txt' } },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: SITE.name,
    title: SITE.title,
    description: SITE.description,
    locale: 'th_TH',
  },
  twitter: { card: 'summary_large_image', title: SITE.title, description: SITE.description },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#1c2849',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()).replace(/</g, '\\u003c') }}
        />
        <NextAuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </NextAuthProvider>
      </body>
    </html>
  );
}
