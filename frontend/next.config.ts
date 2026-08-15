import type {NextConfig} from 'next'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

// Resolve the mast-sanity monorepo root (one level up from this frontend
// workspace) relative to this config file, so Turbopack doesn't traverse into
// a parent directory when a stray package-lock.json exists above it. Computed
// dynamically so the project runs on any machine, not just one hardcoded path.
const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const nextConfig: NextConfig = {
  turbopack: {
    root: monorepoRoot,
  },
  env: {
    // Matches the behavior of `sanity dev` which sets styled-components to use the fastest way of inserting CSS rules in both dev and production. It's default behavior is to disable it in dev mode.
    SC_DISABLE_SPEEDY: 'false',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
      },
    ],
  },
  // Disable the dev indicator (Next.js logo button in bottom-left corner)
  // Errors still show in console and error overlay
  devIndicators: false,
}

export default nextConfig
