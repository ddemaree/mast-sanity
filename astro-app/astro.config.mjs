import {defineConfig} from 'astro/config'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import node from '@astrojs/node'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  site: 'http://localhost:3002',
  output: 'server',
  adapter: node({mode: 'standalone'}),
  integrations: [react(), sitemap()],
  server: {port: 3002},
  vite: {
    plugins: [tailwindcss()],
    esbuild: {
      // Silence 'use client' banner warnings from React package sources
      logOverride: {'this-is-undefined-in-esm': 'silent'},
    },
  },
})
