import { useMemo } from 'react'
import { priorityLeads, priorityContext } from '../lib/leadScoring.js'
import { agentLabel } from '../lib/labels.js'
import { useT } from '../lib/i18n.jsx'
import AiInsights from './AiInsights.jsx'

const REASON = {
  'never-contacted': { label: 'Never contacted', c: '#e52b20' },
  stalling: { label: 'No recent outreach', c: '#d97706' },
  'good-source': { label: 'Strong source', c: '#298de5' },
  'good-country': { label: 'Strong country', c: '#0d1f5e' },
  'advanced-stage': { label: 'Advanced stage', c: '#12b76a' },
  whatsapp: { label: 'WhatsApp', c: '#00acc9' },
}

export default function PriorityLeads({ deals, actIndex, language }) {
  const { t } = useT()
  const rows = useMemo(
    () => priorityLeads(deals, actIndex, Date.now(), 25),
    [deals, actIndex],
  )

  const scoreColor = (s) => (s >= 55 ? '#12b76a' : s >= 40 ? '#298de5' : '#8a99ad')
  const ctx = useMemo(() => priorityContext(rows), [rows])
  const cacheKey = rows.slice(0, 12).map((r) => r.id).join(',')

  return (
    <div style={{ marginTop: 16 }}>
      <div className="card scorecard" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="chart-head" style={{ padding: '16px 18px 6px' }}>
          <h3>⚡ {t('Priority leads — act today')}</h3>
          <span className="chart-sub">{t('ranked by conversion potential + need to follow up')}</span>
        </div>

        <div style={{ padding: '0 18px 8px' }}>
          <AiInsights kind="insights" context={ctx} cacheKey={`priority|${cacheKey}`} language={language} />
        </div>

        <div className="ptable-wrap">
          <table className="ptable">
            <thead>
              <tr>
                <th>#</th>
                <th>{t('Lead')}</th>
                <th>{t('Country')}</th>
                <th>{t('Source')}</th>
                <th>{t('Stage')}</th>
                <th>{t('Last outreach')}</th>
                <th>{t('Agent')}</th>
                <th>{t('Why')}</th>
                <th>{t('Score')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td className="muted">{i + 1}</td>
                  <td><strong>{r.name}</strong></td>
                  <td>{r.country}</td>
                  <td>{r.source}</td>
                  <td>{r.stage}</td>
                  <td>
                    {r.contacted
                      ? (r.daysSince == null ? t('contacted') : `${r.daysSince} ${t('days ago')}`)
                      : <span style={{ color: '#e52b20', fontWeight: 700 }}>{t('never')}</span>}
                  </td>
                  <td>{agentLabel(r.agentId)}</td>
                  <td>
                    <span className="pchips">
                      {r.reasons.slice(0, 3).map((k) =>
                        REASON[k] ? (
                          <span key={k} className="pchip" style={{ color: REASON[k].c, background: REASON[k].c + '22' }}>
                            {t(REASON[k].label)}
                          </span>
                        ) : null,
                      )}
                    </span>
                  </td>
                  <td>
                    <span className="pscore" style={{ color: scoreColor(r.score), background: scoreColor(r.score) + '1c' }}>
                      {r.score}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
