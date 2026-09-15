import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Determine which HTML entry to use per target
  const modeToHtml: Record<string, string> = {
    passenger: 'passenger.html',
    driver: 'driver.html',
    admin: 'admin.html',
    app: 'app.html',
  };

  const htmlFile = modeToHtml[mode] || 'index.html';
  const entryName = modeToHtml[mode] ? mode : 'main';
  const modeToPort: Record<string, number> = {
    passenger: 5273,
    driver: 5274,
    admin: 5275,
    app: 5273,
  };

  return {
    server: {
      host: true,
      port: modeToPort[mode] || 5173,
      strictPort: true,
      // Cloudflare quick tunnels send Host: *.trycloudflare.com
      allowedHosts: true,
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /.*\/script\.google\.com\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'gas-api-cache',
                networkTimeoutSeconds: 5,
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24, // <== 1 day
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            }
          ]
        },
        manifest: {
          name: 'TaxiWork Dispatch',
          short_name: 'TaxiWork',
          description: 'מערכת ניהול ושיגור מוניות מתקדמת',
          theme_color: '#0F172A',
          background_color: '#0F172A',
          display: 'standalone',
          icons: [
            {
              src: 'icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: 'icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }
      }),
      {
        name: 'rename-html',
        enforce: 'post',
        generateBundle(_, bundle) {
          const htmlFileName = modeToHtml[mode] || 'index.html';
          if (bundle[htmlFileName]) {
            bundle['index.html'] = { ...bundle[htmlFileName], fileName: 'index.html' };
            delete bundle[htmlFileName];
          }
        },
      }
    ],
    base: '/',
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-leaflet', 'leaflet']
    },
    build: {
      // On Vercel/CI: always output to `dist` (single-mode deploy per project).
      // Local `build:all`: keep per-mode subfolders so the 3 builds don't clobber each other.
      outDir: (process.env.VERCEL || mode === 'production') ? 'dist' : `dist/${mode}`,
      emptyOutDir: true,
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        input: resolve(__dirname, htmlFile),
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-ui': ['lucide-react', 'recharts'],
          },
        },
      },
    },
  };
});

