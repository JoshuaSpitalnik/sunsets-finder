/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the same build works on GitHub Pages sub-paths and inside Capacitor.
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'מוצא השקיעות — Sunset Finder',
        short_name: 'שקיעות',
        description: 'תחזית שקיעות ומקומות צפייה מדויקים',
        lang: 'he',
        dir: 'rtl',
        theme_color: '#F6F3EE',
        background_color: '#F6F3EE',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        // Android: Share → Sunset Finder files a WhatsApp/Telegram post into Updates.
        share_target: {
          action: './',
          method: 'GET',
          params: { title: 'share_title', text: 'share_text', url: 'share_url' },
        },
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            // Past months of forecasters' posts rarely change: serve from cache, refresh in the background.
            urlPattern: /\/osint-archive\/.*\.json$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'osint-archive', expiration: { maxEntries: 30 } },
          },
          {
            // Forecasters' feed: fresh when online, last copy offline.
            urlPattern: /\/osint\.json$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'osint', networkTimeoutSeconds: 8, expiration: { maxEntries: 2 } },
          },
          {
            // Last forecast stays available offline; fresh data wins when online.
            urlPattern: /^https:\/\/(api|air-quality-api|historical-forecast-api)\.open-meteo\.com\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'weather',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 20, maxAgeSeconds: 6 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
