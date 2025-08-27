import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    lib: {
      entry: 'src/main/index.ts',
      formats: ['cjs'],
      fileName: 'main',
    },
    rollupOptions: {
      external: [
        'electron',
        'better-sqlite3',
        'cloudflare:workers',
        'bun:sqlite',
        'blake3-wasm',
        'alchemy',
        'alchemy/cloudflare',
      ],
    },
    emptyOutDir: false,
  },
})
