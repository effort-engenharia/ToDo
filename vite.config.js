import process from 'node:process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// VITE_PWA_SELF_DESTROY=1 npm run build -> gera um sw.js que se desregistra e limpa os caches (desativação rápida);
// nesse build o app também deixa de registrar o SW (ver registrarPwa.js)
const pwaAutoDestruir = process.env.VITE_PWA_SELF_DESTROY === '1'

const raiz = fileURLToPath(new URL('.', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Service worker próprio em src/sw.js (só app shell; o registro ocorre no módulo Execução, não globalmente)
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: false,
      selfDestroying: pwaAutoDestruir,
      manifest: {
        name: 'Effort Execução',
        short_name: 'Effort',
        description: 'Atividades de campo do módulo Execução',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,woff,woff2,ico,png,svg,webmanifest}'],
        // Chunks pesados de exportação (planilha/PDF), carregados só sob demanda: ficam fora do precache do app shell
        globIgnores: ['test-supabase.html', '**/xlsx-*.js', '**/jspdf*.js', '**/html2canvas*.js', '**/purify*.js', '**/index.es-*.js',
          // Página pública do fornecedor (/cotacao/): fora do app shell e do SW
          'cotacao/**', '**/cotacao-*.js', '**/cotacao-*.css'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024
      }
    })
  ],
  build: {
    rollupOptions: {
      // 2 entradas: app autenticado e página pública de cotação (/cotacao/#token), sem compartilhar o código do app
      input: {
        main: resolve(raiz, 'index.html'),
        cotacao: resolve(raiz, 'cotacao/index.html'),
      },
      output: {
        // Vendors estáveis em chunks próprios: melhor cache entre deploys
        // O chunk `react` inclui jsx-runtime, react-dom/client e scheduler: sem isso eles caem no chunk da entrada `main` e a
        // página pública /cotacao/ puxaria o app logado + supabase.
        manualChunks: (id) => {
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react'
          if (id.includes('node_modules/@supabase/supabase-js/')) return 'supabase'
          return undefined
        },
      },
    },
  },
})
