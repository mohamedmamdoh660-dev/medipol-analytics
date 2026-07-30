import { useEffect, useMemo, useState } from 'react'
import { listUsers, listPermissions, upsertUser, deleteUser } from '../lib/perms.js'
import { createLogin, setPassword, setBlock, deleteLogin, listAccounts } from '../lib/authAdmin.js'
import { AGENTS } from '../lib/labels.js'
import { useT } from '../lib/i18n.jsx'

const agentList = Object.entries(AGENTS)
  .map(([id, name]) => ({ id, name }))
  .sort((a, b) => a.name.localeCompare(b.name))

const CAT_ICON = { Pages: '▤', Data: '◨', Tools: '✦', Admin: '⚙' }

function Icon({ d, size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
  )
}
const mailD = <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-10 6L2 7" /></>
const userD = <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>
const lockD = <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>
const plusD = <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>
const trashD = <><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>
const banD = <><circle cx="12" cy="12" r="10" /><line x1="4.9" y1="4.9" x2="19.1" y2="19.1" /></>

export default function UsersAdmin() {
  const { t } = useT()
  const [rows, setRows] = useState([])
  const [cat, setCat] = useState([])
  const [accounts, setAccounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [pw, setPw] = useState({}) // per-row password input (id → value)
  const [form, setForm] = useState({ email: '', name: '', password: '', agent_id: '' })

  async function reload() {
    setLoading(true)
    try {
      const [u, p] = await Promise.all([listUsers(), listPermissions()])
      setRows(u); setCat(p); setErr('')
    } catch (e) { setErr(e.message || 'load failed') }
    finally { setLoading(false) }
    try { setAccounts(await listAccounts()) } catch { /* backend optional in dev */ }
  }
  useEffect(() => { reload() }, [])

  const groups = useMemo(() => {
    const g = {}
    for (const p of cat) (g[p.category] ||= []).push(p)
    return g
  }, [cat])

  const flash = (m) => { setOk(m); setErr(''); setTimeout(() => setOk(''), 2500) }
  const fail = (e) => setErr(typeof e === 'string' ? e : e.message || 'failed')
  const setRow = (id, patch) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const acct = (email) => accounts[(email || '').toLowerCase()]

  const togglePerm = (row, key) => {
    const set = new Set(row.permissions || [])
    set.has(key) ? set.delete(key) : set.add(key)
    setRow(row.id, { permissions: [...set] })
  }

  async function savePerms(row) {
    setBusy(`save:${row.id}`)
    try {
      await upsertUser({
        id: row.id, email: row.email, name: row.name || null, agent_id: row.agent_id || null,
        is_admin: !!row.is_admin, role: row.is_admin ? 'admin' : 'self',
        permissions: row.is_admin ? [] : (row.permissions || []),
      })
      flash(t('Saved'))
    } catch (e) { fail(e) } finally { setBusy(null) }
  }

  async function add() {
    const email = form.email.trim().toLowerCase()
    if (!email || !form.password) return setErr(t('Email and password are required'))
    setBusy('new')
    try {
      await createLogin(email, form.password) // create the actual login account
      await upsertUser({ email, name: form.name || null, agent_id: form.agent_id || null, role: 'self', is_admin: false, permissions: [] })
      setForm({ email: '', name: '', password: '', agent_id: '' })
      flash(t('User created'))
      await reload()
    } catch (e) { fail(e) } finally { setBusy(null) }
  }

  async function changePw(email) {
    const val = pw[email] || ''
    if (val.length < 6) return setErr(t('Password must be at least 6 characters'))
    setBusy(`pw:${email}`)
    try { await setPassword(email, val); setPw((p) => ({ ...p, [email]: '' })); flash(t('Password changed')) }
    catch (e) { fail(e) } finally { setBusy(null) }
  }

  async function toggleBlock(email, blocked) {
    setBusy(`block:${email}`)
    try { await setBlock(email, blocked); await reload(); flash(blocked ? t('User blocked') : t('User unblocked')) }
    catch (e) { fail(e) } finally { setBusy(null) }
  }

  async function remove(row) {
    if (!window.confirm(t('Delete this user and their login account?'))) return
    setBusy(`del:${row.id}`)
    try {
      await deleteLogin(row.email).catch(() => {}) // remove auth account if any
      await deleteUser(row.id)
      await reload(); flash(t('User deleted'))
    } catch (e) { fail(e) } finally { setBusy(null) }
  }

  const AgentSelect = ({ value, onChange }) => (
    <select className="ua-sel" value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t('— no linked agent —')}</option>
      {agentList.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
    </select>
  )
  const initials = (r) =>
    String(r.name || r.email || '?').replace(/@.*/, '').split(/[\s.]+/).filter(Boolean)
      .slice(0, 2).map((w) => w[0]).join('').toUpperCase()

  return (
    <div className="ua-wrap">
      <div className="ua-header">
        <div>
          <h2>{t('Users & roles')}</h2>
          <p className="muted">{t('create logins, set passwords, block, and control what each person sees')}</p>
        </div>
        <span className="ua-count">{rows.length} {t('users')}</span>
      </div>

      {err && <div className="ua-alert err">{err}</div>}
      {ok && <div className="ua-alert ok">{ok}</div>}

      {/* Add user (with password) */}
      <div className="ua-addbar">
        <div className="ua-inp"><Icon d={mailD} /><input placeholder={t('Email address')} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="ua-inp"><Icon d={userD} /><input placeholder={t('Full name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="ua-inp"><Icon d={lockD} /><input type="text" placeholder={t('Password')} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
        <AgentSelect value={form.agent_id} onChange={(v) => setForm({ ...form, agent_id: v })} />
        <button className="ua-btn primary" onClick={add} disabled={busy === 'new' || !form.email.trim() || !form.password}>
          <Icon d={plusD} size={16} /> {busy === 'new' ? t('Creating…') : t('Add user')}
        </button>
      </div>

      {loading && <p className="muted" style={{ padding: 20 }}>{t('Loading…')}</p>}

      <div className="ua-users">
        {rows.map((r) => {
          const open = expanded === r.id
          const a = acct(r.email)
          const status = !a ? 'nologin' : a.blocked ? 'blocked' : 'active'
          return (
            <div className={`ua-ucard ${open ? 'open' : ''} ${status === 'blocked' ? 'blocked' : ''}`} key={r.id}>
              <div className="ua-uhead">
                <span className={`ua-ava ${r.is_admin ? 'admin' : ''}`}>{initials(r)}</span>
                <div className="ua-meta">
                  <strong>{r.email}</strong>
                  <input className="ua-name" placeholder={t('Full name')} value={r.name || ''} onChange={(e) => setRow(r.id, { name: e.target.value })} />
                </div>
                <span className={`ua-acct ${status}`}>
                  {status === 'active' ? `● ${t('Active')}` : status === 'blocked' ? `● ${t('Blocked')}` : `○ ${t('No login')}`}
                </span>
                <span className={`ua-role ${r.is_admin ? 'admin' : (r.permissions || []).length ? 'custom' : 'none'}`}>
                  {r.is_admin ? t('Admin') : (r.permissions || []).length ? `${(r.permissions || []).length} ${t('permissions')}` : t('No access')}
                </span>
              </div>

              {/* account: password + block */}
              <div className="ua-account">
                <div className="ua-inp sm"><Icon d={lockD} size={14} />
                  <input type="text" placeholder={t('New password')} value={pw[r.email] || ''} onChange={(e) => setPw((p) => ({ ...p, [r.email]: e.target.value }))} />
                </div>
                <button className="ua-btn ghost" onClick={() => changePw(r.email)} disabled={busy === `pw:${r.email}` || !(pw[r.email] || '').trim()}>
                  {a ? t('Change password') : t('Set password')}
                </button>
                {a && (
                  <button className={`ua-btn ${a.blocked ? 'primary' : 'warn'}`} onClick={() => toggleBlock(r.email, !a.blocked)} disabled={busy === `block:${r.email}`}>
                    <Icon d={banD} size={14} /> {a.blocked ? t('Unblock') : t('Block')}
                  </button>
                )}
              </div>

              {/* permissions & role */}
              <div className="ua-controls">
                <label className="ua-ctl">
                  <span className="ua-lbl">{t('Linked agent')}</span>
                  <AgentSelect value={r.agent_id} onChange={(v) => setRow(r.id, { agent_id: v })} />
                </label>
                <label className="ua-switch">
                  <input type="checkbox" checked={!!r.is_admin} onChange={(e) => setRow(r.id, { is_admin: e.target.checked })} />
                  <span className="ua-slider" /><span className="ua-switch-lbl">{t('Admin')}</span>
                </label>
                <div className="ua-actions">
                  {!r.is_admin && (
                    <button className="ua-btn ghost" onClick={() => setExpanded(open ? null : r.id)}>
                      {t('Permissions')} {open ? '▴' : '▾'}
                    </button>
                  )}
                  <button className="ua-btn primary" onClick={() => savePerms(r)} disabled={busy === `save:${r.id}`}>{t('Save')}</button>
                  <button className="ua-btn danger" onClick={() => remove(r)} disabled={busy === `del:${r.id}`} title={t('Delete')}><Icon d={trashD} size={15} /></button>
                </div>
              </div>

              {open && !r.is_admin && (
                <div className="ua-perms">
                  {Object.entries(groups).map(([category, perms]) => (
                    <div className="ua-pgroup" key={category}>
                      <div className="ua-pgroup-h"><span>{CAT_ICON[category] || '•'}</span> {t(category)}</div>
                      <div className="ua-chips">
                        {perms.map((p) => {
                          const on = (r.permissions || []).includes(p.key)
                          return (
                            <button key={p.key} className={`ua-chip ${on ? 'on' : ''}`} onClick={() => togglePerm(r, p.key)}>
                              <span className="ua-check">{on ? '✓' : ''}</span>{t(p.label)}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {!loading && rows.length === 0 && <p className="muted" style={{ padding: 20 }}>{t('No users yet')}</p>}
      </div>
    </div>
  )
}
