import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Weave — A world of your own',
    short_name: 'Weave',
    description: 'A little planet for everything you learn, build, and remember.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0b1020',
    theme_color: '#0b1020',
    icons: [{ src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' }],
  };
}
