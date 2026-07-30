import { supabase } from '../supabase.js'

// Load the signed-in user's permissions. Unknown users default to full access
// (only trusted accounts can log in; the admin assigns scope from Users page).
export async function fetchMyPermission(email) {
  if (!email) return { is_admin: true, seeAll: true, permissions: [] }
  const { data, error } = await supabase
    .from('analytics_users')
    .select('is_admin, permissions, agent_id, name, role, visible_agents')
    .eq('email', email)
    .maybeSingle()
  if (error || !data) return { is_admin: true, seeAll: true, permissions: [], unknown: true }
  const permissions = data.permissions || []
  const is_admin = !!data.is_admin || data.role === 'admin'
  return { ...data, is_admin, permissions, seeAll: is_admin || permissions.includes('data.all') }
}

// Does this user hold a given permission key? Admins hold everything.
export function hasPerm(perm, key) {
  if (!perm) return true // still loading → allow (trusted logins only)
  if (perm.is_admin) return true
  return (perm.permissions || []).includes(key)
}

export function isAdmin(perm) {
  return !!perm && perm.is_admin
}

// null => see everything. Otherwise the Set of agent ids this user may see.
export function allowedAgentIds(perm) {
  if (!perm || perm.seeAll || perm.is_admin) return null
  const ids = new Set()
  if (perm.agent_id) ids.add(String(perm.agent_id))
  ;(perm.visible_agents || []).forEach((a) => ids.add(String(a)))
  return ids
}

export function scopeRows(rows, perm, field) {
  const ids = allowedAgentIds(perm)
  if (!ids) return rows
  return rows.filter((r) => ids.has(String(r[field])))
}

// ---- Users & permissions management (admin) ----
export async function listPermissions() {
  const { data, error } = await supabase
    .from('analytics_permissions')
    .select('*')
    .order('sort', { ascending: true })
  if (error) throw error
  return data || []
}

export async function listUsers() {
  const { data, error } = await supabase
    .from('analytics_users')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function upsertUser(row) {
  const { data, error } = await supabase
    .from('analytics_users')
    .upsert(row, { onConflict: 'email' })
    .select()
  if (error) throw error
  return data?.[0]
}

export async function deleteUser(id) {
  const { error } = await supabase.from('analytics_users').delete().eq('id', id)
  if (error) throw error
}
