import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
  build: {
    // Separa vendors em chunks próprios: cache do navegador sobrevive
    // aos deploys (só o chunk de app muda a cada release).
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          baseui: ['@base-ui/react'],
          pdf: ['@react-pdf/renderer'],
        },
      },
    },
  },
})
