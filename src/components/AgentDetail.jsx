import { useMemo } from 'react'
import { countBy, timeSeries } from '../lib/aggregations.js'
import { dealOutcome, stageMeta, agentLabel, activityProviderLabel } from '../lib/labels.js'
import { ChartCard, AreaTrend, HBar, Donut } from './Charts.jsx'
import Pipeline from './Pipeline.jsx'

const fmt = (n) => (n == null ? '—' : n.toLocaleString('en-US'))
const pct = (n) => (n == null ? '—' : `${n.toFixed(1)}%`)
const hrs = (n) => {
  if (n == null) return '—'
  if (n < 1) return `${Math.round(n * 60)}m`
  if (n < 48) return `${n.toFixed(1)}h`
  return `${(n / 24).toFixed(1)}d`
}

export default function AgentDetail({ agentId, deals, activities, onClose }) {
  const data = useMemo(() => {
    const d = deals.filter((x) => String(x.assigned_by_id) === String(agentId))
    const acts = activities.filter((x) => String(x.responsible_id) === String(agentId))

    let applications = 0
    let completed = 0
    let lost = 0
    for (const x of d) {
      const o = dealOutcome(x)
      if (o === 'S') applications++
      else if (o === 'F') lost++
      if (x.stage_id === 'C2:UC_BUY082' || x.stage_id === 'C2:WON') completed++
    }

    // Outbound activities = the agent actually reaching out.
    const outboundOwners = new Set()
    let outbound = 0
    let inbound = 0
    let respSum = 0
    let respN = 0
    const firstOut = new Map()
    for (const a of acts) {
      const out = a.direction === 2 || a.direction === '2'
      if (out) {
        outbound++
        const o = Number(a.owner_id)
        outboundOwners.add(o)
        const t = a.created ? new Date(a.created).getTime() : NaN
        if (!isNaN(t) && (!firstOut.has(o) || t < firstOut.get(o))) firstOut.set(o, t)
      } else if (a.direction === 1 || a.direction === '1') inbound++
    }
    let contacted = 0
    for (const x of d) {
      if (outboundOwners.has(Number(x.id))) {
        contacted++
        const created = x.date_create ? new Date(x.date_create).getTime() : NaN
        const fo = firstOut.get(Number(x.id))
        if (!isNaN(created) && fo != null && fo >= created) {
          respSum += fo - created
          respN++
        }
      }
    }

    // Deals by stage (this agent's pipeline).
    const stageMap = new Map()
    for (const x of d) stageMap.set(x.stage_id, (stageMap.get(x.stage_id) || 0) + 1)
    const totalD = d.length || 1
    const pipeline = Array.from(stageMap, ([sid, v]) => {
      const m = stageMeta(sid)
      return { stageId: sid, name: m.label, value: v, color: m.color, order: m.order, pct: (v / totalD) * 100 }
    }).sort((a, b) => a.order - b.order)

    return {
      leads: d.length,
      applications,
      completed,
      lost,
      inProgress: d.length - applications - lost,
      appRate: d.length ? (applications / d.length) * 100 : 0,
      complRate: applications ? (completed / applications) * 100 : 0,
      activities: acts.length,
      outbound,
      inbound,
      contactRate: d.length ? (contacted / d.length) * 100 : 0,
      avgRespHrs: respN ? respSum / respN / 3600000 : null,
      pipeline,
      byChannel: countBy(acts, (a) => a.provider_id, { labelFn: activityProviderLabel, keepBlank: true }),
      byCountry: countBy(d, (x) => x.country, { topN: 10 }),
      overTime: timeSeries(d, 'date_create'),
    }
  }, [agentId, deals, activities])

  const STATS = [
    { label: 'Leads', value: fmt(data.leads) },
    { label: 'Applications', value: fmt(data.applications), color: '#22c55e' },
    { label: 'Completed', value: fmt(data.completed), color: '#15803d' },
    { label: 'Lost', value: fmt(data.lost), color: '#dc2626' },
    { label: 'Lead → App', value: pct(data.appRate), color: '#8b5cf6' },
    { label: 'App → Compl', value: pct(data.complRate), color: '#16a34a' },
    { label: 'Activities', value: fmt(data.activities) },
    { label: 'Outbound', value: fmt(data.outbound), color: '#16a34a' },
    { label: 'Inbound', value: fmt(data.inbound), color: '#3b82f6' },
    { label: 'Contacted', value: pct(data.contactRate) },
    { label: 'Avg response', value: hrs(data.avgRespHrs) },
  ]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <strong>{agentLabel(agentId)}</strong>
            <span className="muted"> · agent detail</span>
          </div>
          <button className="btn-ghost sm" onClick={onClose}>✕ Close</button>
        </div>

        <div className="modal-body">
          <div className="detail-stats">
            {STATS.map((s) => (
              <div className="dstat" key={s.label}>
                <span className="dstat-v" style={s.color ? { color: s.color } : undefined}>{s.value}</span>
                <span className="dstat-l">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="grid">
            <ChartCard title="Their pipeline" subtitle="deals by stage" wide height={320}>
              <Pipeline data={data.pipeline} />
            </ChartCard>
            <ChartCard title="Activity channels" subtitle="provider">
              <Donut data={data.byChannel} />
            </ChartCard>
            <ChartCard title="Leads over time" wide>
              <AreaTrend data={data.overTime} color="#c0102f" />
            </ChartCard>
            <ChartCard title="Top countries">
              <HBar data={data.byCountry} />
            </ChartCard>
          </div>
        </div>
      </div>
    </div>
  )
}
