import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served under a sub-path in production (e.g. /analytics) but at the root during
// local `npm run dev`. Set BASE_PATH to change the sub-path (default /analytics).
const raw = process.env.BASE_PATH || '/analytics'
const BASE = '/' + raw.replace(/^\/+|\/+$/g, '') + '/' // normalise → "/analytics/"

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : BASE, // dev at root, build under sub-path
  plugins: [react()],
  server: { port: 5173, open: true },
  preview: { port: 4173 },
}))
