import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {readdirSync, readFileSync} from 'node:fs';
import {defineConfig, type Plugin} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  const configuredBase = process.env.VITE_BASE || '/';
  const base = configuredBase.endsWith('/') ? configuredBase : `${configuredBase}/`;
  const isAndroid = process.env.VITE_ANDROID_APP === 'true';

  return {
    base,
    build: {copyPublicDir: !isAndroid},
    plugins: [
      react(),
      tailwindcss(),
      ...(isAndroid ? [{
        name: 'android-public-assets',
        // Android needs menu photos and icons, never a nested APK or website guide.
        generateBundle() {
          const publicRoot = path.resolve(__dirname, 'public');
          const emitTree = (relative: string) => {
            for (const entry of readdirSync(path.join(publicRoot, relative), {withFileTypes: true})) {
              const child = path.posix.join(relative, entry.name);
              if (entry.isDirectory()) emitTree(child);
              else if (entry.isFile()) this.emitFile({type: 'asset', fileName: child, source: readFileSync(path.join(publicRoot, child))});
            }
          };
          emitTree('assets');
          emitTree('icon-options');
        },
      } satisfies Plugin] : []),
      VitePWA({
        registerType: 'prompt',
        includeAssets: [
          'icon-options/app-icon-v2-48.png',
          'icon-options/app-icon-v2-180.png',
          'icon-options/app-icon-v2-192.png',
          'icon-options/app-icon-v2-512.png',
        ],
        manifest: {
          id: base,
          name: 'CJ POS',
          short_name: 'CJ POS',
          description: 'Local-first ordering, cashier, kitchen display and sales export for small F&B businesses.',
          lang: 'en',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'any',
          background_color: '#09090b',
          theme_color: '#09090b',
          categories: ['business', 'food', 'productivity'],
          icons: [
            {
              src: 'icon-options/app-icon-v2-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'icon-options/app-icon-v2-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'icon-options/app-icon-v2-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          shortcuts: [
            {
              name: 'Staff Register',
              short_name: 'Register',
              url: `${base}#/cashier`,
              icons: [{src: 'icon-options/app-icon-v2-192.png', sizes: '192x192'}],
            },
            {
              name: 'Kitchen Display',
              short_name: 'Kitchen',
              url: `${base}#/cashier/kitchen`,
              icons: [{src: 'icon-options/app-icon-v2-192.png', sizes: '192x192'}],
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{html,js,css,png,jpg,jpeg,svg,webp,woff2}'],
          globIgnores: [
            '**/assets/pos-hero-v1.png',
            '**/icon-options/app-icon-v2-1024.png',
            '**/icon-options/app-icon-v2-phone-first.png',
            '**/icon-options/option-*.png',
          ],
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/\.well-known\//, /\/(?:downloads|media)\//],
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              urlPattern: ({request}) => request.destination === 'image',
              handler: 'CacheFirst',
              options: {
                cacheName: 'cj-pos-images-v1',
                cacheableResponse: {statuses: [0, 200]},
                expiration: {
                  maxEntries: 80,
                  maxAgeSeconds: 30 * 24 * 60 * 60,
                },
              },
            },
          ],
          clientsClaim: false,
          skipWaiting: false,
        },
        devOptions: {
          enabled: true,
          type: 'module',
          navigateFallback: 'index.html',
          suppressWarnings: true,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
