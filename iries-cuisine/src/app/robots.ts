import type { MetadataRoute } from 'next'
import { publicEnv } from '@/lib/public-env'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/staff', '/admin', '/api', '/t/', '/pay/', '/checkout', '/account', '/orders', '/login', '/cart'],
      },
    ],
    sitemap: `${publicEnv.siteUrl}/sitemap.xml`,
  }
}
