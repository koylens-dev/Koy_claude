import type { MetadataRoute } from 'next'

// Installable on Android and iPhone straight from the browser (no app store).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: "Irie's Cuisine",
    short_name: "Irie's",
    description: 'Order Ghanaian food from Irie’s Cuisine, Adenta — pay with MoMo or card and track your order live.',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fbf6ef',
    theme_color: '#9e3b22',
    lang: 'en-GH',
    categories: ['food', 'shopping'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'My orders', url: '/orders', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Catering', url: '/catering', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  }
}
