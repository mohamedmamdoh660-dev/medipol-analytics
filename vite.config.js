import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Default: served at the ROOT of its own (sub)domain, e.g.
// https://analytics-automation.medipol.edu.tr
// To serve under a sub-path instead, set BASE_PATH=/analytics (build-time).
const raw = process.env.BASE_PATH ?? '/'
const BASE = raw === '/' || raw === '' ? '/' : '/' + raw.replace(/^\/+|\/+$/g, '') + '/'

export default defineConfig({
  base: BASE,
  plugins: [react()],
  server: { port: 5173, open: true },
  preview: { port: 4173 },
})
