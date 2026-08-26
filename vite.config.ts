import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { jsonFileBridge } from './tools/json-file-bridge.js'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), ...(command === 'serve' ? [jsonFileBridge()] : [])],
  resolve: {
    alias: {
      '@novakai/canvas': fileURLToPath(new URL('./packages/canvas/contract/index.ts', import.meta.url)),
    },
  },
  test: { exclude: [...configDefaults.exclude, '**/.worktrees/**'] },
}))
