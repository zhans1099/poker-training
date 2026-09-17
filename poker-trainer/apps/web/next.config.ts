import type { NextConfig } from 'next'
import { loadWorkspaceEnvironment } from '../../packages/database/src/environment'

loadWorkspaceEnvironment()

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@poker-trainer/domain', '@poker-trainer/poker-engine'],
}

export default nextConfig
