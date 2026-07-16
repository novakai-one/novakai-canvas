import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { jsonFileBridge } from './tools/json-file-bridge.js'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), ...(command === 'serve' ? [jsonFileBridge()] : [])],
}))
