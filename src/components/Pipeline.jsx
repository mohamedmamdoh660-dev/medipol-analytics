// Horizontal pipeline / funnel: one row per real Bitrix stage, ordered by
// the stage order, bar width scaled to the largest stage.
import { useT } from '../lib/i18n.jsx'

export default function Pipeline({ data }) {
  const { t } = useT()
  if (!data || data.length === 0) {
    return <div className="chart-empty">{t('No data')}</div>
  }
  const max = Math.max(...data.map((d) => d.value), 1)
  const fmt = (n) => n.toLocaleString('en-US')

  return (
    <div className="pipeline">
      {data.map((s) => (
        <div className="pipe-row" key={s.stageId}>
          <div className="pipe-name" title={s.stageId}>
            {s.name}
          </div>
          <div className="pipe-track">
            <div
              className="pipe-fill"
              style={{
                width: `${(s.value / max) * 100}%`,
                background: s.color,
              }}
            >
              <span className="pipe-count">{fmt(s.value)}</span>
            </div>
          </div>
          <div className="pipe-pct">{s.pct.toFixed(1)}%</div>
        </div>
      ))}
    </div>
  )
}
