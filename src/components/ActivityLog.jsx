import { useMemo, useState } from 'react'
import { useT } from '../lib/i18n.jsx'
import { istanbul } from '../lib/tz.js'

const DAY = 24 * 60 * 60 * 1000

function dayKey(ts) {
  if (!ts) return ''
  return istanbul(ts)?.dayKey || ''
}
function fmtTime(ts) {
  const d = new Date(ts)
  if (isNaN(d)) return '—'
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}
function fmt(n) {
  return n.toLocaleString('en-US')
}

const CHANNEL_STYLE = {
  Email: { bg: 'rgba(59,130,246,.14)', fg: '#3b82f6' },
  'Web form': { bg: 'rgba(41,141,229,.14)', fg: '#298de5' },
  'Chat / WhatsApp': { bg: 'rgba(20,184,166,.16)', fg: '#0d9488' },
  Call: { bg: 'rgba(139,92,246,.14)', fg: '#8b5cf6' },
  Task: { bg: 'rgba(245,158,11,.16)', fg: '#d97706' },
}
function channelChip(ch) {
  const s = CHANNEL_STYLE[ch] || { bg: 'var(--hover)', fg: 'var(--muted)' }
  return (
    <span className="chip" style={{ background: s.bg, color: s.fg }}>
      {ch}
    </span>
  )
}

export default function ActivityLog({ activities }) {
  const { t } = useT()
  // The most recent day that actually has data — used as the default view.
  const latestKey = useMemo(() => {
    let mx = ''
    for (const a of activities) {
      const k = dayKey(a.created)
      if (k > mx) mx = k
    }
    return mx
  }, [activities])

  const [mode, setMode] = useState('day') // 'day' | '7d' | 'all'
  const [day, setDay] = useState('')
  const [search, setSearch] = useState('')

  const selectedDay = day || latestKey

  const rows = useMemo(() => {
    let list = activities
    if (mode === 'day') {
      list = activities.filter((a) => dayKey(a.created) === selectedDay)
    } else if (mode === '7d') {
      const end = new Date((selectedDay || latestKey) + 'T23:59:59Z').getTime()
      const start = end - 7 * DAY
      list = activities.filter((a) => {
        const t = new Date(a.created).getTime()
        return !isNaN(t) && t >= start && t <= end
      })
    }
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (a) =>
          a.agent?.toLowerCase().includes(q) ||
          a._student?.toLowerCase().includes(q) ||
          a._country?.toLowerCase().includes(q) ||
          a.channel?.toLowerCase().includes(q),
      )
    }
    return [...list].sort((a, b) => new Date(b.created) - new Date(a.created))
  }, [activities, mode, selectedDay, latestKey, search])

  const stats = useMemo(() => {
    const byAgent = new Map()
    const byChannel = new Map()
    let incoming = 0
    let outgoing = 0
    for (const a of rows) {
      byAgent.set(a.agent, (byAgent.get(a.agent) || 0) + 1)
      byChannel.set(a.channel, (byChannel.get(a.channel) || 0) + 1)
      if (a.direction === 1 || a.direction === '1') incoming++
      else if (a.direction === 2 || a.direction === '2') outgoing++
    }
    return {
      total: rows.length,
      agents: byAgent.size,
      incoming,
      outgoing,
      byAgent: Array.from(byAgent, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      byChannel: Array.from(byChannel, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    }
  }, [rows])

  const CAP = 400
  const shown = rows.slice(0, CAP)

  const rangeLabel =
    mode === 'all'
      ? t('All time')
      : mode === '7d'
      ? `7d → ${selectedDay}`
      : selectedDay

  return (
    <div className="card activity-log">
      <div className="chart-head log-head">
        <h3>{t('Activity log — who did what')}</h3>
      </div>

      <div className="log-controls">
        <div className="seg">
          <button className={mode === 'day' ? 'on' : ''} onClick={() => setMode('day')}>
            {t('Single day')}
          </button>
          <button className={mode === '7d' ? 'on' : ''} onClick={() => setMode('7d')}>
            {t('Last 7 days')}
          </button>
          <button className={mode === 'all' ? 'on' : ''} onClick={() => setMode('all')}>
            {t('All time')}
          </button>
        </div>
        <input
          type="date"
          value={selectedDay}
          max={latestKey}
          onChange={(e) => {
            setDay(e.target.value)
            if (mode === 'all') setMode('day')
          }}
        />
        <button className="btn-ghost sm" onClick={() => setDay(latestKey)}>
          {t('Latest day')}
        </button>
        <input
          className="log-search"
          type="text"
          placeholder={t('Search agent / student / country…')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="log-stats">
        <div className="stat">
          <span className="stat-v">{fmt(stats.total)}</span>
          <span className="stat-l">{t('activities')} · {rangeLabel}</span>
        </div>
        <div className="stat">
          <span className="stat-v">{fmt(stats.agents)}</span>
          <span className="stat-l">{t('active agents')}</span>
        </div>
        <div className="stat">
          <span className="stat-v" style={{ color: '#3b82f6' }}>{fmt(stats.incoming)}</span>
          <span className="stat-l">{t('incoming')}</span>
        </div>
        <div className="stat">
          <span className="stat-v" style={{ color: '#16a34a' }}>{fmt(stats.outgoing)}</span>
          <span className="stat-l">{t('outgoing')}</span>
        </div>
      </div>

      {stats.byAgent.length > 0 && (
        <div className="agent-chips">
          {stats.byAgent.map((a) => (
            <span className="agent-chip" key={a.name}>
              {a.name}
              <b>{fmt(a.value)}</b>
            </span>
          ))}
        </div>
      )}

      <div className="log-table-wrap">
        <table className="log-table">
          <thead>
            <tr>
              <th>{t('Time')}</th>
              <th>{t('Agent')}</th>
              <th>{t('Channel')}</th>
              <th>{t('Direction')}</th>
              <th>{t('Lead / Student')}</th>
              <th>{t('Country')}</th>
              <th>{t('Stage')}</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={7} className="log-empty">
                  {t('No activity for this selection')}
                </td>
              </tr>
            )}
            {shown.map((a) => (
              <tr key={a.id}>
                <td className="mono">{fmtTime(a.created)}</td>
                <td>{a.agent}</td>
                <td>{channelChip(a.channel)}</td>
                <td>
                  <span className={a.direction === 1 || a.direction === '1' ? 'dir in' : 'dir out'}>
                    {t(a.direction_label)}
                  </span>
                </td>
                <td>{a._student || <span className="muted">—</span>}</td>
                <td>{a._country || <span className="muted">—</span>}</td>
                <td>{a._stage || <span className="muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > CAP && (
        <div className="log-note muted">
          Showing first {CAP} of {fmt(rows.length)} — narrow the date or search to see the rest.
        </div>
      )}
    </div>
  )
}
