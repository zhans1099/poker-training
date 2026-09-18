import type { NextConfig } from 'next'
import { loadWorkspaceEnvironment } from '../../packages/database/src/environment'

loadWorkspaceEnvironment()

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@poker-trainer/domain', '@poker-trainer/poker-engine'],
  headers() {
    return Promise.resolve([
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive, nosnippet, noimageindex',
          },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ])
  },
}

export default nextConfig
