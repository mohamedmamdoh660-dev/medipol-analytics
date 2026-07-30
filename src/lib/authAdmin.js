import { supabase } from '../supabase.js'

// Calls the in-project secure backend (holds the service_role) with the current
// admin's access token. The backend re-verifies admin before doing anything.
const API = `${import.meta.env.BASE_URL}api/admin`

async function token() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || ''
}

async function post(pathName, body) {
  const res = await fetch(`${API}/${pathName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
    body: JSON.stringify(body || {}),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.error || `error ${res.status}`)
  return j
}

export const createLogin = (email, password) => post('create-user', { email, password })
export const setPassword = (email, password) => post('set-password', { email, password })
export const setBlock = (email, blocked) => post('set-block', { email, blocked })
export const deleteLogin = (email) => post('delete-user', { email })

export async function listAccounts() {
  const res = await fetch(`${API}/accounts`, { headers: { Authorization: `Bearer ${await token()}` } })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.error || `error ${res.status}`)
  return j.accounts || {}
}
