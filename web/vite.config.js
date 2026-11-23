import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const pocketbase = 'http://127.0.0.1:8090'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // tailscale serve forwards with the ts.net Host header
    allowedHosts: ['.ts.net'],
    proxy: {
      '/api': pocketbase,
      '/_': pocketbase
    }
  },
  // Builds land in web/dist; scripts/deploy.sh copies them into server/pb_public (which the live
  // server serves) together with the matching migrations, so a build never goes live half-done.
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
