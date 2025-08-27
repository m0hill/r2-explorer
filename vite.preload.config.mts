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
      entry: 'src/preload.ts',
      formats: ['cjs'],
      fileName: 'preload',
    },
    rollupOptions: {
      external: ['electron'],
    },
    emptyOutDir: false,
  },
})
