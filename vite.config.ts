import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// `base: './'` : chemins relatifs, l'app fonctionne quel que soit le sous-dossier
// (GitHub Pages : https://<utilisateur>.github.io/<dépôt>/).
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Vitalis – Muscle, nutrition & longévité',
        short_name: 'Vitalis',
        description: 'Programme de musculation, nutrition, liste de courses, balance Withings, prise de sang et compléments personnalisés.',
        lang: 'fr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0d0d0d',
        theme_color: '#0f7a5c',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallbackDenylist: [/^\/__/],
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
