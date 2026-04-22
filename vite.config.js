import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      'predicatively-magnesian-pansy.ngrok-free.dev'
    ]
  }
})