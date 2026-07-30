import { useEffect, useMemo, useState } from 'react'
import { listUsers, listPermissions, upsertUser, deleteUser } from '../lib/perms.js'
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
const plusD = <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>
const trashD = <><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>

export default function UsersAdmin() {
  const { t } = useT()
  const [rows, setRows] = useState([])
  const [cat, setCat] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [form, setForm] = useState({ email: '', name: '', agent_id: '' })

  async function reload() {
    setLoading(true)
    try {
      const [u, p] = await Promise.all([listUsers(), listPermissions()])
      setRows(u); setCat(p); setErr('')
    } catch (e) { setErr(e.message || 'load failed') }
    finally { setLoading(false) }
  }
  useEffect(() => { reload() }, [])

  const groups = useMemo(() => {
    const g = {}
    for (const p of cat) (g[p.category] ||= []).push(p)
    return g
  }, [cat])

  const setRow = (id, patch) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const togglePerm = (row, key) => {
    const set = new Set(row.permissions || [])
    set.has(key) ? set.delete(key) : set.add(key)
    setRow(row.id, { permissions: [...set] })
  }

  async function save(row) {
    setBusy(row.id || 'new')
    try {
      await upsertUser({
        ...(row.id ? { id: row.id } : {}),
        email: row.email.trim().toLowerCase(),
        name: row.name || null,
        agent_id: row.agent_id || null,
        is_admin: !!row.is_admin,
        role: row.is_admin ? 'admin' : 'self',
        permissions: row.is_admin ? [] : (row.permissions || []),
      })
      await reload()
    } catch (e) { setErr(e.message || 'save failed') }
    finally { setBusy(null) }
  }

  async function add() {
    if (!form.email.trim()) return
    await save({ ...form, is_admin: false, permissions: [] })
    setForm({ email: '', name: '', agent_id: '' })
  }

  async function remove(id) {
    if (!window.confirm(t('Delete this user?'))) return
    setBusy(id)
    try { await deleteUser(id); await reload() }
    catch (e) { setErr(e.message || 'delete failed') }
    finally { setBusy(null) }
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
          <p className="muted">{t('who can log in and exactly what each person may see')}</p>
        </div>
        <span className="ua-count">{rows.length} {t('users')}</span>
      </div>

      {err && <div className="login-error" style={{ marginBottom: 14 }}>{err}</div>}

      {/* Add user */}
      <div className="ua-addbar">
        <div className="ua-inp"><Icon d={mailD} /><input placeholder={t('Email address')} value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="ua-inp"><Icon d={userD} /><input placeholder={t('Full name')} value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <AgentSelect value={form.agent_id} onChange={(v) => setForm({ ...form, agent_id: v })} />
        <button className="ua-btn primary" onClick={add} disabled={busy === 'new' || !form.email.trim()}>
          <Icon d={plusD} size={16} /> {t('Add user')}
        </button>
      </div>

      {loading && <p className="muted" style={{ padding: 20 }}>{t('Loading…')}</p>}

      <div className="ua-users">
        {rows.map((r) => {
          const open = expanded === r.id
          const count = (r.permissions || []).length
          return (
            <div className={`ua-ucard ${open ? 'open' : ''}`} key={r.id}>
              <div className="ua-uhead">
                <span className={`ua-ava ${r.is_admin ? 'admin' : ''}`}>{initials(r)}</span>
                <div className="ua-meta">
                  <strong>{r.email}</strong>
                  <input className="ua-name" placeholder={t('Full name')} value={r.name || ''}
                    onChange={(e) => setRow(r.id, { name: e.target.value })} />
                </div>
                <span className={`ua-role ${r.is_admin ? 'admin' : count ? 'custom' : 'none'}`}>
                  {r.is_admin ? t('Admin') : count ? `${count} ${t('permissions')}` : t('No access')}
                </span>
              </div>

              <div className="ua-controls">
                <label className="ua-ctl">
                  <span className="ua-lbl">{t('Linked agent')}</span>
                  <AgentSelect value={r.agent_id} onChange={(v) => setRow(r.id, { agent_id: v })} />
                </label>

                <label className="ua-switch" title={t('Full access to everything')}>
                  <input type="checkbox" checked={!!r.is_admin} onChange={(e) => setRow(r.id, { is_admin: e.target.checked })} />
                  <span className="ua-slider" />
                  <span className="ua-switch-lbl">{t('Admin')}</span>
                </label>

                <div className="ua-actions">
                  {!r.is_admin && (
                    <button className="ua-btn ghost" onClick={() => setExpanded(open ? null : r.id)}>
                      {t('Permissions')} {open ? '▴' : '▾'}
                    </button>
                  )}
                  <button className="ua-btn primary" onClick={() => save(r)} disabled={busy === r.id}>{t('Save')}</button>
                  <button className="ua-btn danger" onClick={() => remove(r.id)} disabled={busy === r.id} title={t('Delete')}>
                    <Icon d={trashD} size={15} />
                  </button>
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

      <p className="muted ua-note">
        {t('This controls what each person sees inside the app. Login accounts (email + password) are created separately.')}
      </p>
    </div>
  )
}
