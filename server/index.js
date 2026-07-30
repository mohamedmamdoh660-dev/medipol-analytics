// Tiny secure backend: serves the built SPA and exposes admin-only endpoints
// for managing login accounts (create / set password / block / delete). The
// service_role key lives ONLY here (server side) — never in the browser bundle.
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, '..', 'dist')

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const OLLAMA_URL = (process.env.OLLAMA_URL || process.env.VITE_OLLAMA_URL || '').replace(/\/$/, '')
const PORT = Number(process.env.PORT) || 80

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.warn('[admin] SUPABASE_URL / SUPABASE_SERVICE_ROLE not set — admin endpoints disabled.')
}

// Admin client (bypasses RLS). Used only after we verify the caller is an admin.
const admin = SUPABASE_URL && SERVICE_ROLE
  ? createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } })
  : null
// Public client — validates a caller's session token for the AI proxy.
const pub = SUPABASE_URL && ANON
  ? createClient(SUPABASE_URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } })
  : admin

// Any signed-in user (used by the AI proxy).
async function requireUser(req, res, next) {
  if (!pub) return res.status(503).json({ error: 'backend not configured' })
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ error: 'missing token' })
    const { data: { user }, error } = await pub.auth.getUser(token)
    if (error || !user) return res.status(401).json({ error: 'invalid session' })
    req.caller = user
    next()
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) })
  }
}

const app = express()
app.use(express.json())

app.get('/health', (_req, res) => res.type('text').send('ok'))

// --- auth guard: caller must be a signed-in admin ---------------------------
async function requireAdmin(req, res, next) {
  if (!admin) return res.status(503).json({ error: 'admin backend not configured' })
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ error: 'missing token' })
    const { data: { user }, error } = await admin.auth.getUser(token)
    if (error || !user) return res.status(401).json({ error: 'invalid session' })
    const { data: row } = await admin
      .from('analytics_users')
      .select('is_admin, role')
      .eq('email', user.email)
      .maybeSingle()
    if (!row || !(row.is_admin || row.role === 'admin')) {
      return res.status(403).json({ error: 'admin only' })
    }
    req.caller = user
    next()
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) })
  }
}

async function findUserByEmail(email) {
  const target = String(email || '').trim().toLowerCase()
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw new Error(error.message)
  return data.users.find((u) => (u.email || '').toLowerCase() === target) || null
}

// --- create a login account with a chosen password --------------------------
app.post('/api/admin/create-user', requireAdmin, async (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'email and password required' })
  const { data, error } = await admin.auth.admin.createUser({
    email: String(email).trim().toLowerCase(),
    password,
    email_confirm: true, // usable immediately, no confirmation email needed
  })
  if (error) return res.status(400).json({ error: error.message })
  res.json({ ok: true, id: data.user.id })
})

// --- change any user's password ---------------------------------------------
app.post('/api/admin/set-password', requireAdmin, async (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'email and password required' })
  try {
    const u = await findUserByEmail(email)
    if (!u) return res.status(404).json({ error: 'no login account for this email' })
    const { error } = await admin.auth.admin.updateUserById(u.id, { password })
    if (error) return res.status(400).json({ error: error.message })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) })
  }
})

// --- block / unblock a login account ----------------------------------------
app.post('/api/admin/set-block', requireAdmin, async (req, res) => {
  const { email, blocked } = req.body || {}
  if (!email) return res.status(400).json({ error: 'email required' })
  try {
    const u = await findUserByEmail(email)
    if (!u) return res.status(404).json({ error: 'no login account for this email' })
    const { error } = await admin.auth.admin.updateUserById(u.id, {
      ban_duration: blocked ? '876000h' : 'none', // ~100 years / lifted
    })
    if (error) return res.status(400).json({ error: error.message })
    res.json({ ok: true, blocked: !!blocked })
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) })
  }
})

// --- delete the login account (permissions row is removed by the client) ----
app.post('/api/admin/delete-user', requireAdmin, async (req, res) => {
  const { email } = req.body || {}
  if (!email) return res.status(400).json({ error: 'email required' })
  try {
    const u = await findUserByEmail(email)
    if (u) {
      const { error } = await admin.auth.admin.deleteUser(u.id)
      if (error) return res.status(400).json({ error: error.message })
    }
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) })
  }
})

// --- report which emails have a login account + blocked state ---------------
app.get('/api/admin/accounts', requireAdmin, async (_req, res) => {
  try {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (error) return res.status(400).json({ error: error.message })
    const now = Date.now()
    const map = {}
    for (const u of data.users) {
      const banned = u.banned_until && new Date(u.banned_until).getTime() > now
      map[(u.email || '').toLowerCase()] = { exists: true, blocked: !!banned }
    }
    res.json({ accounts: map })
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) })
  }
})

// --- AI proxy: forward chat to Ollama server-side (no browser CORS) ---------
app.post('/api/ai/chat', requireUser, async (req, res) => {
  if (!OLLAMA_URL) return res.status(503).json({ error: 'AI endpoint not configured' })
  try {
    const upstream = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...req.body, stream: false }),
    })
    const text = await upstream.text()
    res.status(upstream.status).type('application/json').send(text)
  } catch (e) {
    res.status(502).json({ error: `AI upstream error: ${String(e?.message || e)}` })
  }
})

// --- static SPA + client-side fallback --------------------------------------
app.use(express.static(DIST))
app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')))

app.listen(PORT, '0.0.0.0', () => console.log(`[analytics] serving on :${PORT}`))
