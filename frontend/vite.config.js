import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    port: 5173,
    proxy: {
      '/health': 'http://localhost:3000',
      '/webhooks': 'http://localhost:3000',
      '/auth': 'http://localhost:3000',
      '/api': 'http://localhost:3000'
    }
  }
})

