import { useT } from '../lib/i18n.jsx'

const fmt = (n) => (n == null ? '—' : n.toLocaleString('en-US'))
const days = (n) => {
  if (n == null) return '—'
  if (n < 1) return `${Math.round(n * 24)}h`
  return `${n.toFixed(1)}d`
}

export default function FunnelVelocity({ data, loading }) {
  const { t } = useT()
  if (loading) {
    return (
      <div className="card chart-card" style={{ marginTop: 16 }}>
        <div className="chart-empty">{t('Loading stage history…')}</div>
      </div>
    )
  }
  if (!data || data.stages.length === 0) {
    return (
      <div className="card chart-card" style={{ marginTop: 16 }}>
        <div className="chart-empty">{t('No stage history for this selection')}</div>
      </div>
    )
  }

  const max = Math.max(...data.stages.map((s) => s.reached), 1)

  return (
    <div className="card scorecard" style={{ marginTop: 16 }}>
      <div className="chart-head">
        <h3>{t('Funnel velocity')}</h3>
      </div>

      <div className="funnel">
        {data.stages.map((s) => (
          <div className="frow" key={s.stageId}>
            <div className="fname" title={s.stageId}>{s.name}</div>
            <div className="ftrack">
              <div className="ffill" style={{ width: `${(s.reached / max) * 100}%`, background: s.color }}>
                <span className="fcount">{fmt(s.reached)}</span>
              </div>
            </div>
            <div className="fconv">{s.reachPct.toFixed(1)}%</div>
            <div className="ftime">{days(s.avgDays)}</div>
          </div>
        ))}
      </div>

      <div className="funnel-legend muted">
        <span><b>Bar / count</b> = distinct deals that ever reached the stage</span>
        <span><b>%</b> = share of all {data.totalDeals.toLocaleString('en-US')} deals</span>
        <span><b>Time</b> = avg. spent in stage before moving on</span>
      </div>
    </div>
  )
}
