import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WMS AI Platform',
    short_name: 'WMS',
    description: 'AI-powered B2B Warehouse Management System',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1d4ed8', // Tailwind blue-700
    icons: [
      {
        src: '/icon.png', 
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon.png', 
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}

