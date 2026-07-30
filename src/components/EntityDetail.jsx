import { useMemo, useState } from 'react'
import { countBy, timeSeries } from '../lib/aggregations.js'
import { matchField } from '../lib/aiquery.js'
import {
  dealOutcome,
  stageMeta,
  agentLabel,
  activityProviderLabel,
  stageSemanticLabel,
  sourceLabel,
} from '../lib/labels.js'
import { ChartCard, AreaTrend, HBar, Donut } from './Charts.jsx'
import Pipeline from './Pipeline.jsx'
import { useT } from '../lib/i18n.jsx'
import { istanbul, periodAnchors } from '../lib/tz.js'
import AiInsights from './AiInsights.jsx'

const fmt = (n) => (n == null ? '—' : n.toLocaleString('en-US'))
const pct = (n) => (n == null ? '—' : `${n.toFixed(1)}%`)
const hrs = (n) => {
  if (n == null) return '—'
  if (n < 1) return `${Math.round(n * 60)}m`
  if (n < 48) return `${n.toFixed(1)}h`
  return `${(n / 24).toFixed(1)}d`
}
const fmtTime = (ts) => {
  const d = new Date(ts)
  if (isNaN(d)) return '—'
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
}
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Categorize one activity: { key, label, emoji, group } where group is
// 'out' (employee action) or 'in' (something that came in on the lead).
// Notes: chat/WhatsApp rows are SESSIONS (conversations), not messages; tasks
// are split into completed (done) vs pending (backlog).
function catAct(a) {
  const p = a.provider_id
  const out = a.direction === 2 || a.direction === '2'
  if (p === 'CRM_EMAIL')
    return out
      ? { key: 'email_out', label: 'Emails sent', emoji: '✉️', group: 'out' }
      : { key: 'email_in', label: 'Emails received', emoji: '📥', group: 'in' }
  if (p === 'VOXIMPLANT_CALL')
    return out
      ? { key: 'call_out', label: 'Calls made', emoji: '📞', group: 'out' }
      : { key: 'call_in', label: 'Calls received', emoji: '📞', group: 'in' }
  if (p === 'IMOPENLINES_SESSION')
    return out
      ? { key: 'chat_out', label: 'Chats — agent replied', emoji: '💬', group: 'out' }
      : { key: 'chat_in', label: 'Chats — client started', emoji: '💬', group: 'in' }
  if (p === 'CRM_WEBFORM') return { key: 'webform', label: 'Web form submissions', emoji: '📝', group: 'in' }
  if (p === 'CRM_TODO')
    return a.completed
      ? { key: 'task_done', label: 'Follow-ups done', emoji: '✅', group: 'out' }
      : { key: 'task_pending', label: 'Follow-ups open (backlog)', emoji: '🕗', group: 'backlog' }
  if (p === 'CRM_SMS')
    return out
      ? { key: 'sms_out', label: 'SMS sent', emoji: '📱', group: 'out' }
      : { key: 'sms_in', label: 'SMS received', emoji: '📱', group: 'in' }
  return { key: 'other', label: p || 'Other', emoji: '•', group: 'out' }
}

const FIELD_LABEL = {
  country: 'Country', nationality: 'Nationality', stage: 'Outcome', level: 'Level',
  faculty: 'Faculty', program: 'Program', source: 'Source', region: 'Region',
  period: 'Application period', campaign: 'Ad campaign', agent: 'Agent',
}

const CHANNEL_COLOR = {
  Email: '#3b82f6', 'Web form': '#298de5', 'Chat / WhatsApp': '#0d9488',
  Call: '#8b5cf6', Task: '#d97706', SMS: '#0ea5e9',
}
function channelChip(ch) {
  const c = CHANNEL_COLOR[ch] || '#64748b'
  return <span className="chip" style={{ background: `${c}22`, color: c }}>{ch}</span>
}

function valueLabel(field, value) {
  if (field === 'agent') return agentLabel(value)
  if (field === 'stage') return stageSemanticLabel(value)
  if (field === 'source') return sourceLabel(value)
  return value
}

const EMPTY = { from: '', to: '', country: '', stage: '', source: '' }

export default function EntityDetail({ field, value, deals, enrichedActivities, onClose }) {
  const { t, lang } = useT()
  const [lf, setLf] = useState(EMPTY)
  const setF = (patch) => setLf((p) => ({ ...p, ...patch }))

  const base = useMemo(() => deals.filter((x) => matchField(x, field, value)), [deals, field, value])

  const opts = useMemo(() => {
    const c = new Set()
    const s = new Set()
    for (const d of base) {
      if (d.country) c.add(d.country)
      if (d.source_id) s.add(d.source_id)
    }
    return {
      countries: Array.from(c).sort(),
      sources: Array.from(s).sort(),
    }
  }, [base])

  const data = useMemo(() => {
    const fromT = lf.from ? new Date(lf.from + 'T00:00:00').getTime() : null
    const toT = lf.to ? new Date(lf.to + 'T23:59:59').getTime() : null
    const inRange = (ts) => {
      if (!fromT && !toT) return true
      const t = ts ? new Date(ts).getTime() : NaN
      if (isNaN(t)) return false
      if (fromT && t < fromT) return false
      if (toT && t > toT) return false
      return true
    }

    const d = base.filter((x) => {
      if (lf.country && x.country !== lf.country) return false
      if (lf.stage && dealOutcome(x) !== lf.stage) return false
      if (lf.source && x.source_id !== lf.source) return false
      if ((fromT || toT) && !inRange(x.date_create)) return false
      return true
    })
    const dealIds = new Set(d.map((x) => Number(x.id)))

    // Activities: for an agent, the ones THEY performed; otherwise those on the
    // subset's deals. Then apply the same country/date filters.
    let acts = field === 'agent'
      ? enrichedActivities.filter((a) => String(a.responsible_id) === String(value))
      : enrichedActivities.filter((a) => dealIds.has(Number(a.owner_id)))
    acts = acts.filter((a) => {
      if (lf.country && a._country !== lf.country) return false
      if ((fromT || toT) && !inRange(a.created)) return false
      return true
    })

    let applications = 0, completed = 0, lost = 0
    for (const x of d) {
      const o = dealOutcome(x)
      if (o === 'S') applications++
      else if (o === 'F') lost++
      if (x.stage_id === 'C2:UC_BUY082' || x.stage_id === 'C2:WON') completed++
    }

    const outboundOwners = new Set()
    let outbound = 0, inbound = 0, done = 0
    const firstOut = new Map()
    const byHour = new Array(24).fill(0)
    const byWeekday = new Array(7).fill(0)
    for (const a of acts) {
      const out = a.direction === 2 || a.direction === '2'
      const ist = a.created ? istanbul(a.created) : null
      if (a.completed) done++
      if (out) {
        outbound++
        const o = Number(a.owner_id)
        outboundOwners.add(o)
        if (ist) {
          byHour[ist.hour]++
          byWeekday[ist.wIdx]++
          const tm = new Date(a.created).getTime()
          if (!firstOut.has(o) || tm < firstOut.get(o)) firstOut.set(o, tm)
        }
      } else if (a.direction === 1 || a.direction === '1') inbound++
    }
    let contacted = 0, respSum = 0, respN = 0
    for (const x of d) {
      if (outboundOwners.has(Number(x.id))) {
        contacted++
        const created = x.date_create ? new Date(x.date_create).getTime() : NaN
        const fo = firstOut.get(Number(x.id))
        if (!isNaN(created) && fo != null && fo >= created) { respSum += fo - created; respN++ }
      }
    }

    const stageMap = new Map()
    for (const x of d) stageMap.set(x.stage_id, (stageMap.get(x.stage_id) || 0) + 1)
    const totalD = d.length || 1
    const pipeline = Array.from(stageMap, ([sid, v]) => {
      const m = stageMeta(sid)
      return { stageId: sid, name: m.label, value: v, color: m.color, order: m.order, pct: (v / totalD) * 100 }
    }).sort((a, b) => a.order - b.order)

    const recent = [...acts].sort((a, b) => new Date(b.created) - new Date(a.created)).slice(0, 150)

    // Detailed activity breakdown by type, split into what the employee DID
    // (outbound) vs what came IN on their leads (inbound).
    const typeMap = new Map()
    for (const a of acts) {
      const c = catAct(a)
      let e = typeMap.get(c.key)
      if (!e) {
        e = { ...c, value: 0 }
        typeMap.set(c.key, e)
      }
      e.value++
    }
    const allTypes = Array.from(typeMap.values()).sort((x, y) => y.value - x.value)
    const outTypes = allTypes.filter((x) => x.group === 'out')
    const inTypes = allTypes.filter((x) => x.group === 'in')
    const backlogTypes = allTypes.filter((x) => x.group === 'backlog')

    // Activity by calendar period (today / yesterday / this week / this month)
    // in Istanbul local time, from all the entity's activities regardless of
    // the date filter above.
    const anc = periodAnchors()
    const baseIds = new Set(base.map((x) => Number(x.id)))
    const pacts = field === 'agent'
      ? enrichedActivities.filter((a) => String(a.responsible_id) === String(value))
      : enrichedActivities.filter((a) => baseIds.has(Number(a.owner_id)))
    const per = {
      today: { did: 0, recv: 0 }, yesterday: { did: 0, recv: 0 },
      week: { did: 0, recv: 0 }, month: { did: 0, recv: 0 },
    }
    // "did" = employee actions (the outbound group from catAct, incl. tasks);
    // "recv" = what came in on their leads. Same split as the breakdown.
    for (const a of pacts) {
      const ist = a.created ? istanbul(a.created) : null
      if (!ist) continue
      const g = catAct(a).group
      if (g === 'backlog') continue // open reminders are neither done nor received
      const k = ist.dayKey
      const bump = (b) => { if (g === 'out') b.did++; else b.recv++ }
      if (k === anc.todayKey) bump(per.today)
      else if (k === anc.yesterdayKey) bump(per.yesterday)
      if (k >= anc.last7Key) bump(per.week)
      if (k >= anc.last30Key) bump(per.month)
    }

    return {
      leads: d.length, applications, completed, lost,
      appRate: d.length ? (applications / d.length) * 100 : 0,
      complRate: applications ? (completed / applications) * 100 : 0,
      activities: acts.length, outbound, inbound, done,
      donePct: acts.length ? (done / acts.length) * 100 : 0,
      contactRate: d.length ? (contacted / d.length) * 100 : 0,
      avgRespHrs: respN ? respSum / respN / 3600000 : null,
      pipeline,
      byChannel: countBy(acts, (a) => a.provider_id, { labelFn: activityProviderLabel, keepBlank: true }),
      byAgent: countBy(d, (x) => x.assigned_by_id, { topN: 10, labelFn: agentLabel, keepBlank: true }),
      bySource: countBy(d, (x) => x.source_id, { topN: 8, labelFn: sourceLabel, keepBlank: true }),
      byCountry: countBy(d, (x) => x.country, { topN: 10 }),
      overTime: timeSeries(d, 'date_create'),
      actOverTime: timeSeries(acts, 'created'),
      byDirection: [
        { name: 'Outbound', value: outbound },
        { name: 'Incoming', value: inbound },
      ].filter((x) => x.value > 0),
      byWeekday: byWeekday.map((v, i) => ({ name: WEEKDAYS[i], value: v })).filter((x) => x.value > 0),
      recent,
      periods: per,
      outTypes,
      inTypes,
      backlogTypes,
    }
  }, [base, field, value, enrichedActivities, lf])

  const OUTCOMES = [
    { label: 'Leads', value: fmt(data.leads), color: '#298de5' },
    { label: 'Applications', value: fmt(data.applications), color: '#22c55e' },
    { label: 'Completed', value: fmt(data.completed), color: '#15803d' },
    { label: 'Lost', value: fmt(data.lost), color: '#dc2626' },
    { label: 'Lead → App', value: pct(data.appRate), color: '#8b5cf6' },
    { label: 'App → Compl', value: pct(data.complRate), color: '#16a34a' },
  ]
  const ENGAGE = [
    { label: 'Activities', value: fmt(data.activities), color: '#6366f1' },
    { label: 'Outbound', value: fmt(data.outbound), color: '#16a34a' },
    { label: 'Inbound', value: fmt(data.inbound), color: '#3b82f6' },
    { label: 'Completed acts', value: pct(data.donePct), color: '#84cc16' },
    { label: 'Contacted', value: pct(data.contactRate), color: '#0ea5e9' },
    { label: 'Avg response', value: hrs(data.avgRespHrs), color: '#f59e0b' },
  ]
  const PERIODS = [
    { key: 'today', label: 'Today', color: '#00acc9' },
    { key: 'yesterday', label: 'Yesterday', color: '#8b5cf6' },
    { key: 'week', label: 'Last 7 days', color: '#3b82f6' },
    { key: 'month', label: 'Last 30 days', color: '#16a34a' },
  ]

  const showAgent = field !== 'agent'
  const showCountry = field !== 'country' && field !== 'nationality'
  const filtersActive = JSON.stringify(lf) !== JSON.stringify(EMPTY)
  const rangeText = !lf.from && !lf.to ? t('All time') : `${lf.from || '…'} → ${lf.to || '…'}`
  const title = valueLabel(field, value)
  const initials = String(title).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

  const tb = (arr) => (arr || []).map((x) => `${x.label} ${x.value}`).join(', ') || 'none'
  const aiSummaryCtx = [
    `Entity: ${title} (${field}). Period: ${rangeText}.`,
    `Outcomes: leads ${data.leads}, applications ${data.applications}, completed ${data.completed}, lost ${data.lost}.`,
    `Engagement: ${data.activities} activities, outbound ${data.outbound}, inbound ${data.inbound}, contacted ${Number(data.contactRate || 0).toFixed(1)}%, avg first response ${data.avgRespHrs ? Number(data.avgRespHrs).toFixed(1) + 'h' : 'n/a'}.`,
    `Outbound: ${tb(data.outTypes)}. Inbound: ${tb(data.inTypes)}. Pending follow-ups: ${tb(data.backlogTypes)}.`,
  ].join('\n')

  const metricGrid = (items) => (
    <div className="metric-grid">
      {items.map((s) => (
        <div className="metric-card" key={s.label} style={{ '--accent': s.color }}>
          <span className="metric-v">{s.value}</span>
          <span className="metric-l">{t(s.label)}</span>
        </div>
      ))}
    </div>
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel report" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head report-head">
          <div className="rh-id">
            <span className="rh-avatar" aria-hidden>{initials || '•'}</span>
            <div>
              <strong>{title}</strong>
              <div className="rh-sub muted">{t(FIELD_LABEL[field] || field)} · {t('detail')}</div>
            </div>
          </div>
          <button className="btn-ghost sm" onClick={onClose}>✕ {t('Close')}</button>
        </div>

        <div className="modal-body report-body">
          <div className="filters card" style={{ margin: '0 0 18px' }}>
            <div className="filters-top">
              <div className="filter-field compact">
                <label>{t('From')}</label>
                <input type="date" value={lf.from} onChange={(e) => setF({ from: e.target.value })} />
              </div>
              <div className="filter-field compact">
                <label>{t('To')}</label>
                <input type="date" value={lf.to} onChange={(e) => setF({ to: e.target.value })} />
              </div>
              <div className="filter-field">
                <label>{t('Outcome')}</label>
                <select value={lf.stage} onChange={(e) => setF({ stage: e.target.value })}>
                  <option value="">{t('All')}</option>
                  <option value="P">{stageSemanticLabel('P')}</option>
                  <option value="S">{stageSemanticLabel('S')}</option>
                  <option value="F">{stageSemanticLabel('F')}</option>
                </select>
              </div>
              {showCountry && (
                <div className="filter-field">
                  <label>{t('Country')}</label>
                  <select value={lf.country} onChange={(e) => setF({ country: e.target.value })}>
                    <option value="">{t('All')}</option>
                    {opts.countries.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
              <div className="filter-field">
                <label>{t('Source')}</label>
                <select value={lf.source} onChange={(e) => setF({ source: e.target.value })}>
                  <option value="">{t('All')}</option>
                  {opts.sources.map((s) => <option key={s} value={s}>{sourceLabel(s)}</option>)}
                </select>
              </div>
              {filtersActive && (
                <button className="btn-ghost sm" onClick={() => setLf(EMPTY)}>{t('Reset')}</button>
              )}
            </div>
            <div className="scope-note muted">
              {t('Showing')}: <b>{rangeText}</b> · {t('period cards are always relative to today')}
            </div>
          </div>

          <AiInsights
            kind="summary"
            context={aiSummaryCtx}
            cacheKey={`ed|${field}|${value}|${rangeText}`}
            language={lang}
          />

          <section className="report-section">
            <div className="rs-head"><h3>{t('Outcomes')}</h3></div>
            {metricGrid(OUTCOMES)}
          </section>

          <section className="report-section">
            <div className="rs-head"><h3>{t('Engagement')}</h3></div>
            {metricGrid(ENGAGE)}
          </section>

          <section className="report-section">
            <div className="rs-head"><h3>{t('Activity by period')}</h3><span className="muted">{t('what they did · inbound below')}</span></div>
            <div className="period-grid">
              {PERIODS.map((p) => (
                <div className="period-card" key={p.key} style={{ '--accent': p.color }}>
                  <span className="period-v">{data.periods[p.key].did.toLocaleString('en-US')}</span>
                  <span className="period-l">{t(p.label)}</span>
                  <span className="period-sub">{data.periods[p.key].recv.toLocaleString('en-US')} {t('Inbound').toLowerCase()}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="report-section">
            <div className="rs-head"><h3>{t('Activity breakdown')}</h3><span className="muted">{t('what they actually did')}</span></div>
            {data.outTypes.length === 0 && data.inTypes.length === 0 && data.backlogTypes.length === 0 ? (
              <div className="chart-empty">{t('No data')}</div>
            ) : (
              <>
                <div className="break-group-label">↗ {t('Outbound — done by them')}</div>
                <div className="type-grid">
                  {data.outTypes.map((tp) => (
                    <div className="type-card" key={tp.key}>
                      <span className="type-emoji" aria-hidden>{tp.emoji}</span>
                      <div className="type-body">
                        <span className="type-v">{tp.value.toLocaleString('en-US')}</span>
                        <span className="type-l">{t(tp.label)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {data.backlogTypes.length > 0 && (
                  <>
                    <div className="break-group-label backlog">🕗 {t('Open backlog — not done')}</div>
                    <div className="type-grid">
                      {data.backlogTypes.map((tp) => (
                        <div className="type-card" key={tp.key}>
                          <span className="type-emoji" aria-hidden>{tp.emoji}</span>
                          <div className="type-body">
                            <span className="type-v">{tp.value.toLocaleString('en-US')}</span>
                            <span className="type-l">{t(tp.label)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {data.inTypes.length > 0 && (
                  <>
                    <div className="break-group-label in">↘ {t('Inbound — came in')}</div>
                    <div className="type-grid">
                      {data.inTypes.map((tp) => (
                        <div className="type-card" key={tp.key}>
                          <span className="type-emoji" aria-hidden>{tp.emoji}</span>
                          <div className="type-body">
                            <span className="type-v">{tp.value.toLocaleString('en-US')}</span>
                            <span className="type-l">{t(tp.label)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div className="log-note muted">{t('Chats = conversations (sessions). Follow-ups = CRM reminders, not the Bitrix Tasks module.')}</div>
              </>
            )}
          </section>

          <section className="report-section">
            <div className="rs-head"><h3>{t('Pipeline & profile')}</h3></div>
            <div className="grid">
              <ChartCard title="Pipeline" subtitle="deals by stage" wide height={300}>
                <Pipeline data={data.pipeline} />
              </ChartCard>
              {showAgent ? (
                <ChartCard title="By agent"><HBar data={data.byAgent} /></ChartCard>
              ) : (
                <ChartCard title="Leads over time"><AreaTrend data={data.overTime} color="#298de5" /></ChartCard>
              )}
              {showCountry && <ChartCard title="Top countries"><HBar data={data.byCountry} /></ChartCard>}
            </div>
          </section>

          <section className="report-section">
            <div className="rs-head"><h3>{t('Activity detail')}</h3></div>
            <div className="grid">
              <ChartCard title="Activities over time" wide>
                <AreaTrend data={data.actOverTime} color="#6366f1" />
              </ChartCard>
              <ChartCard title="Channels" subtitle="provider">
                <Donut data={data.byChannel} />
              </ChartCard>
              <ChartCard title="Direction" subtitle="in / out">
                <Donut data={data.byDirection} />
              </ChartCard>
              <ChartCard title="Busiest days" subtitle="by weekday (Istanbul)">
                <HBar data={data.byWeekday} />
              </ChartCard>
            </div>
          </section>

          <section className="report-section card scorecard">
            <div className="chart-head">
              <h3>{t('Activity log')}</h3>
            </div>
            <div className="log-table-wrap">
              <table className="log-table">
                <thead>
                  <tr><th>{t('Time')}</th><th>{t('Channel')}</th><th>{t('Direction')}</th><th>{t('Lead / Student')}</th><th>{t('Country')}</th><th>{t('Stage')}</th></tr>
                </thead>
                <tbody>
                  {data.recent.length === 0 && (
                    <tr><td colSpan={6} className="log-empty">{t('No activities for this selection')}</td></tr>
                  )}
                  {data.recent.map((a) => (
                    <tr key={a.id}>
                      <td className="mono">{fmtTime(a.created)}</td>
                      <td>{channelChip(a.channel)}</td>
                      <td>
                        <span className={a.direction === 2 || a.direction === '2' ? 'dir out' : 'dir in'}>
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
          </section>
        </div>
      </div>
    </div>
  )
}
