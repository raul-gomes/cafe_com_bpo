import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // O Vitest grava o cache de resultados em `node_modules/.vite/vitest`. Quando
    // a imagem do container web cria esse diretório como root, o `vitest run`
    // falha no host com EACCES ao abrir `results.json`. `VITEST_CACHE_DIR` aponta
    // o cache para um diretório gravável e não muda o comportamento padrão de quem
    // não define a variável.
    cache: { dir: process.env.VITEST_CACHE_DIR ?? 'node_modules/.vite/vitest' },
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
  },
})
