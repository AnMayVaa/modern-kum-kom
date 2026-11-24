import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.shortTitle,
    short_name: 'คำคม',
    description: SITE.description,
    lang: 'th',
    start_url: '/',
    display: 'standalone',
    background_color: '#e2e7f2',
    theme_color: '#1c2849',
    categories: ['games', 'education'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
