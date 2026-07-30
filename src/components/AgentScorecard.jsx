import { useMemo, useState } from 'react'
import { useT } from '../lib/i18n.jsx'

const fmt = (n) => (n == null ? '—' : n.toLocaleString('en-US'))
const pct = (n) => (n == null ? '—' : `${n.toFixed(1)}%`)
const hrs = (n) => {
  if (n == null) return '—'
  if (n < 1) return `${Math.round(n * 60)}m`
  if (n < 48) return `${n.toFixed(1)}h`
  return `${(n / 24).toFixed(1)}d`
}

const COLS = [
  { key: 'name', label: 'Agent', num: false },
  { key: 'leads', label: 'Leads', num: true },
  { key: 'won', label: 'Applications', num: true },
  { key: 'completed', label: 'Completed', num: true },
  { key: 'lost', label: 'Lost', num: true },
  { key: 'appRate', label: 'Lead→App', num: true },
  { key: 'complRate', label: 'App→Compl', num: true },
  { key: 'activities', label: 'Activities', num: true },
  { key: 'contactRate', label: 'Contacted', num: true },
  { key: 'avgRespHrs', label: 'Avg response', num: true },
]

export default function AgentScorecard({ rows, onSelect }) {
  const { t } = useT()
  const [sort, setSort] = useState({ key: 'leads', dir: 'desc' })

  const sorted = useMemo(() => {
    const arr = [...rows]
    const { key, dir } = sort
    arr.sort((a, b) => {
      let av = a[key]
      let bv = b[key]
      if (key === 'name') return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      av = av == null ? -1 : av
      bv = bv == null ? -1 : bv
      return dir === 'asc' ? av - bv : bv - av
    })
    return arr
  }, [rows, sort])

  const click = (key) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))

  const convColor = (c) => (c >= 5 ? '#16a34a' : c >= 1 ? '#f59e0b' : '#dc2626')

  return (
    <div className="card scorecard">
      <div className="chart-head">
        <h3>{t('Agent scorecard')}</h3>
        <span className="chart-sub">{t('click a row for full agent detail')}</span>
      </div>
      <div className="log-table-wrap">
        <table className="log-table score-table">
          <thead>
            <tr>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  onClick={() => click(c.key)}
                  className={`sortable ${c.num ? 'num' : ''} ${sort.key === c.key ? 'active' : ''}`}
                >
                  {t(c.label)}
                  {sort.key === c.key ? (sort.dir === 'desc' ? ' ▾' : ' ▴') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className="clickable-row" onClick={() => onSelect && onSelect(r.id)}>
                <td>{r.name}</td>
                <td className="num">{fmt(r.leads)}</td>
                <td className="num" style={{ color: '#22c55e' }}>{fmt(r.won)}</td>
                <td className="num" style={{ color: '#15803d' }}>{fmt(r.completed)}</td>
                <td className="num" style={{ color: '#dc2626' }}>{fmt(r.lost)}</td>
                <td className="num">
                  <span className="pill" style={{ color: convColor(r.appRate) }}>{pct(r.appRate)}</span>
                </td>
                <td className="num">
                  <span className="pill" style={{ color: convColor(r.complRate) }}>{pct(r.complRate)}</span>
                </td>
                <td className="num">{fmt(r.activities)}</td>
                <td className="num">{pct(r.contactRate)}</td>
                <td className="num">{hrs(r.avgRespHrs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="log-note muted">
        Applications = reached Application Started+ · Lead→App = applications ÷ leads · App→Compl =
        completed ÷ applications · Contacted / Avg response = based on outbound activities only.
      </div>
    </div>
  )
}
