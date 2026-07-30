import { useMemo, useState } from 'react'
import { sourceRoi } from '../lib/advanced.js'
import { sourceLabel } from '../lib/labels.js'
import { useT } from '../lib/i18n.jsx'

const fmt = (n) => n.toLocaleString('en-US')

const DIMENSIONS = [
  { key: 'source_id', label: 'Source' },
  { key: 'ad_campaign', label: 'Ad campaign' },
  { key: 'lead_source', label: 'Lead source' },
]

export default function SourceROI({ deals }) {
  const { t } = useT()
  const [dim, setDim] = useState('source_id')
  const rows = useMemo(() => sourceRoi(deals, dim, 12), [deals, dim])
  const maxConv = Math.max(...rows.map((r) => r.conversion), 1)

  return (
    <div className="card sourceroi">
      <div className="chart-head">
        <h3>{t('Source / Campaign ROI')}</h3>
      </div>

      <div className="seg small">
        {DIMENSIONS.map((d) => (
          <button key={d.key} className={dim === d.key ? 'on' : ''} onClick={() => setDim(d.key)}>
            {t(d.label)}
          </button>
        ))}
      </div>

      <div className="log-table-wrap" style={{ marginTop: 12 }}>
        <table className="log-table score-table">
          <thead>
            <tr>
              <th>{t(DIMENSIONS.find((d) => d.key === dim).label)}</th>
              <th className="num">{t('Leads')}</th>
              <th className="num">{t('Won')}</th>
              <th className="num">{t('Lost')}</th>
              <th>{t('Conversion')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td title={r.name} className="ellip">{dim === 'source_id' ? sourceLabel(r.name) : r.name}</td>
                <td className="num">{fmt(r.leads)}</td>
                <td className="num" style={{ color: '#16a34a' }}>{fmt(r.won)}</td>
                <td className="num" style={{ color: '#dc2626' }}>{fmt(r.lost)}</td>
                <td>
                  <div className="conv-cell">
                    <div className="conv-track">
                      <div
                        className="conv-fill"
                        style={{
                          width: `${(r.conversion / maxConv) * 100}%`,
                          background: r.conversion >= 5 ? '#16a34a' : r.conversion >= 1 ? '#f59e0b' : '#c0102f',
                        }}
                      />
                    </div>
                    <span className="conv-val">{r.conversion.toFixed(1)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
