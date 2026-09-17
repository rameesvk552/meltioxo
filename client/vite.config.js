import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Updates are user-confirmed so an in-progress sale or form is never
      // interrupted by an automatic page reload.
      registerType: 'prompt',
      injectRegister: false,
      // The glob below already includes the manifest icons; avoid adding the
      // same URLs to Workbox's precache manifest a second time.
      includeManifestIcons: false,
      manifest: {
        id: '/',
        name: 'Wayon Perfume ERP',
        short_name: 'Wayon',
        description: 'Perfume manufacturing, inventory, sales, and accounting in one place.',
        start_url: '/app/dashboard',
        scope: '/',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        orientation: 'any',
        background_color: '#f7f3ee',
        theme_color: '#b54230',
        categories: ['business', 'productivity', 'finance'],
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'New POS Sale',
            short_name: 'New Sale',
            url: '/app/retail-sales/new',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Dashboard',
            short_name: 'Dashboard',
            url: '/app/dashboard',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Sales & Invoices',
            short_name: 'Sales',
            url: '/app/retail-sales',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        // Never treat API URLs as SPA navigation or add API data to a cache.
        navigateFallbackDenylist: [/^\/api(?:\/|$)/],
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
