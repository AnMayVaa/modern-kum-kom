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

export const metadata: Metadata = {
  title: 'คำคม | เกมต่ออักษรไทยออนไลน์',
  description: 'เล่นคำคม (Kum-Kom) เกมต่อคำภาษาไทยบนกระดาน 15×15 กับบอทหรือกับเพื่อนแบบออนไลน์',
  applicationName: 'คำคม',
  openGraph: {
    title: 'คำคม — เกมต่ออักษรไทย',
    description: 'ต่อคำภาษาไทยบนกระดาน แข่งกับบอทสามระดับ หรือชวนเพื่อนมาเล่นออนไลน์',
    locale: 'th_TH',
    type: 'website',
  },
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
        <NextAuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </NextAuthProvider>
      </body>
    </html>
  );
}
