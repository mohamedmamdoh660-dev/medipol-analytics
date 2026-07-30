import { HBar } from './Charts.jsx'
import { useT } from '../lib/i18n.jsx'

const fmt = (n) => (n == null ? '—' : n.toLocaleString('en-US'))
const hrs = (n) => {
  if (n == null) return '—'
  if (n < 1) return `${Math.round(n * 60)}m`
  if (n < 48) return `${n.toFixed(1)}h`
  return `${(n / 24).toFixed(1)}d`
}

export default function LeadHygiene({ hygiene, speed }) {
  const { t } = useT()
  return (
    <>
      <div className="grid">
        <div className="card chart-card">
          <div className="chart-head">
            <h3>{t('Response speed')}</h3>
          </div>
          <div className="mini-kpi">
            <span className="mini-v">{hrs(speed.avgHrs)}</span>
            <span className="mini-l">{fmt(speed.count)} {t('contacted')}</span>
          </div>
          <div style={{ height: 200 }}>
            <HBar data={speed.buckets} />
          </div>
        </div>

        <div className="card chart-card">
          <div className="chart-head">
            <h3>{t('Lead hygiene')}</h3>
          </div>
          <div className="hygiene-stats">
            <div className="stat">
              <span className="stat-v">{hygiene.contactRate.toFixed(1)}%</span>
              <span className="stat-l">{t('contact rate')}</span>
            </div>
            <div className="stat">
              <span className="stat-v" style={{ color: '#16a34a' }}>{fmt(hygiene.contacted)}</span>
              <span className="stat-l">{t('contacted')}</span>
            </div>
            <div className="stat">
              <span className="stat-v" style={{ color: '#dc2626' }}>{fmt(hygiene.never)}</span>
              <span className="stat-l">{t('never contacted')}</span>
            </div>
            <div className="stat">
              <span className="stat-v" style={{ color: '#f59e0b' }}>{fmt(hygiene.stale)}</span>
              <span className="stat-l">{t('stale (14d+)')}</span>
            </div>
          </div>
        </div>

        <div className="card chart-card">
          <div className="chart-head">
            <h3>{t('Stale open leads by agent')}</h3>
          </div>
          <div style={{ height: 260 }}>
            <HBar data={hygiene.byAgent} />
          </div>
        </div>
      </div>

      <div className="card scorecard" style={{ marginTop: 16 }}>
        <div className="chart-head">
          <h3>{t('Oldest stale open leads')}</h3>
        </div>
        <div className="log-table-wrap">
          <table className="log-table score-table">
            <thead>
              <tr>
                <th>{t('Deal ID')}</th>
                <th>{t('Student')}</th>
                <th>{t('Country')}</th>
                <th>{t('Agent')}</th>
                <th className="num">{t('Idle days')}</th>
                <th>{t('Contacted?')}</th>
              </tr>
            </thead>
            <tbody>
              {hygiene.oldest.length === 0 && (
                <tr>
                  <td colSpan={6} className="log-empty">{t('No data')}</td>
                </tr>
              )}
              {hygiene.oldest.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.id}</td>
                  <td>{r.student || <span className="muted">—</span>}</td>
                  <td>{r.country || <span className="muted">—</span>}</td>
                  <td>{r.agent}</td>
                  <td className="num">{fmt(r.days)}</td>
                  <td>
                    {r.contacted ? (
                      <span className="dir in">{t('Yes')}</span>
                    ) : (
                      <span className="dir out" style={{ color: '#dc2626' }}>{t('Never')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
