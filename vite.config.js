import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      'predicatively-magnesian-pansy.ngrok-free.dev'
    ],
    proxy: {
      '/comparison': {
        target: 'https://roa-data-backend-neon.vercel.app',
        changeOrigin: true,
        secure: true,
      },
      '/brokerage_engine': {
        target: 'https://roa-data-backend-neon.vercel.app',
        changeOrigin: true,
        secure: true,
      }
    }
  }
})