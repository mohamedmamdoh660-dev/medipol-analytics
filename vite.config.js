import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The app is served under a sub-path (default /analytics). Set BASE_PATH to change
// it; dev, preview and build all use the same base so local testing matches prod.
// For root-path local dev, run:  BASE_PATH=/ npm run dev
const raw = process.env.BASE_PATH ?? '/analytics'
const BASE = raw === '/' ? '/' : '/' + raw.replace(/^\/+|\/+$/g, '') + '/'

export default defineConfig({
  base: BASE,
  plugins: [react()],
  server: { port: 5173, open: true },
  preview: { port: 4173 },
})
