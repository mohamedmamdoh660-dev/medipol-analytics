import {
  stageSemanticLabel,
  activityProviderLabel,
  directionLabel,
  agentLabel,
  stageMeta,
  dealOutcome,
  sourceLabel,
} from './labels.js'

const isBlank = (v) => v == null || v === '' || v === '(null)'

// Generic "group by a key and count", returning [{name, value}] sorted desc.
export function countBy(rows, keyFn, { topN = null, labelFn = null, keepBlank = false } = {}) {
  const map = new Map()
  for (const r of rows) {
    let k = keyFn(r)
    if (isBlank(k)) {
      if (!keepBlank) continue
      k = '(Unspecified)'
    }
    k = String(k)
    map.set(k, (map.get(k) || 0) + 1)
  }
  let arr = Array.from(map, ([name, value]) => ({
    name: labelFn ? labelFn(name) : name,
    rawKey: name,
    value,
  }))
  arr.sort((a, b) => b.value - a.value)
  if (topN && arr.length > topN) {
    const head = arr.slice(0, topN)
    const rest = arr.slice(topN).reduce((s, x) => s + x.value, 0)
    if (rest > 0) head.push({ name: 'Other', rawKey: '__other__', value: rest })
    return head
  }
  return arr
}

function toDayKey(ts) {
  if (!ts) return null
  const d = new Date(ts)
  if (isNaN(d)) return null
  return d.toISOString().slice(0, 10)
}

// Daily counts between the first and last day present, gaps filled with 0.
export function timeSeries(rows, dateField) {
  const counts = new Map()
  let min = null
  let max = null
  for (const r of rows) {
    const key = toDayKey(r[dateField])
    if (!key) continue
    counts.set(key, (counts.get(key) || 0) + 1)
    if (min === null || key < min) min = key
    if (max === null || key > max) max = key
  }
  if (!min) return []
  const out = []
  const cur = new Date(min + 'T00:00:00Z')
  const end = new Date(max + 'T00:00:00Z')
  while (cur <= end) {
    const key = cur.toISOString().slice(0, 10)
    out.push({ date: key, value: counts.get(key) || 0 })
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return out
}

const NEG_REASONS = [
  ['neg_reason_contact_failed', 'Contact failed'],
  ['neg_reason_unqualified', 'Unqualified'],
  ['neg_reason_lead_lost', 'Lead lost'],
  ['neg_reason_mio', 'MIO reason'],
  ['neg_reason_mebis', 'MEBIS reason'],
]

// How many deals carry each negative reason (a deal may have more than one).
export function negativeReasons(deals) {
  const out = NEG_REASONS.map(([field, label]) => ({
    name: label,
    value: deals.reduce((s, d) => s + (!isBlank(d[field]) ? 1 : 0), 0),
  }))
  return out.filter((x) => x.value > 0).sort((a, b) => b.value - a.value)
}

// Full pipeline: count per real stage_id, ordered by the stage order
// (not by count) so it reads like a funnel. Each entry carries its color.
export function pipelineByStage(deals) {
  const map = new Map()
  for (const d of deals) {
    const k = d.stage_id || '(none)'
    map.set(k, (map.get(k) || 0) + 1)
  }
  const total = deals.length || 1
  const arr = Array.from(map, ([stageId, value]) => {
    const meta = stageMeta(stageId)
    return {
      stageId,
      name: meta.label,
      value,
      order: meta.order,
      kind: meta.kind,
      color: meta.color,
      pct: (value / total) * 100,
    }
  })
  arr.sort((a, b) => a.order - b.order || b.value - a.value)
  return arr
}

// Attach the parent deal (student / country / stage) to each activity via
// owner_id = deal.id, so the activity log can show "who did what, on whom".
export function enrichActivities(activities, dealsById) {
  return activities.map((a) => {
    const deal = dealsById.get(Number(a.owner_id)) || dealsById.get(String(a.owner_id))
    return {
      ...a,
      _student: deal?.student_name || '',
      _country: deal?.country || '',
      _stage: deal ? stageMeta(deal.stage_id).label : '',
      channel: activityProviderLabel(a.provider_id),
      direction_label: directionLabel(a.direction),
      agent: agentLabel(a.responsible_id),
    }
  })
}

export function computeKpis(deals, activities) {
  const total = deals.length
  let won = 0
  let lost = 0
  let inProgress = 0
  let completed = 0
  let whatsapp = 0
  const countries = new Set()
  const now = Date.now()
  const THIRTY = 30 * 24 * 60 * 60 * 1000
  let last30 = 0

  for (const d of deals) {
    const o = dealOutcome(d)
    if (o === 'S') won++
    else if (o === 'F') lost++
    else inProgress++
    if (d.stage_id === 'C2:UC_BUY082' || d.stage_id === 'C2:WON') completed++
    if (d.contacted_whatsapp === true) whatsapp++
    if (!isBlank(d.country)) countries.add(d.country)
    const t = d.date_create ? new Date(d.date_create).getTime() : NaN
    if (!isNaN(t) && now - t <= THIRTY) last30++
  }

  // Two meaningful conversions for Pipeline 1:
  //  appRate  = leads that became applications (Application Started+)
  //  complRate = applications that reached Application Completed+
  const appRate = total > 0 ? (won / total) * 100 : 0
  const complRate = won > 0 ? (completed / won) * 100 : 0

  const actTotal = activities.length
  const actDone = activities.reduce((s, a) => s + (a.completed ? 1 : 0), 0)
  const actDonePct = actTotal > 0 ? (actDone / actTotal) * 100 : 0

  return {
    total,
    won,
    lost,
    inProgress,
    completed,
    appRate,
    complRate,
    last30,
    whatsapp,
    countries: countries.size,
    actTotal,
    actDone,
    actDonePct,
  }
}

// Bundle every chart dataset the dashboard needs from a filtered dataset.
export function buildCharts(deals, activities) {
  return {
    dealsOverTime: timeSeries(deals, 'date_create'),
    pipeline: pipelineByStage(deals),
    byStage: countBy(deals, (d) => dealOutcome(d), { labelFn: stageSemanticLabel, keepBlank: true }),
    byCountry: countBy(deals, (d) => d.country, { topN: 12 }),
    byNationality: countBy(deals, (d) => d.student_nationality, { topN: 12 }),
    bySource: countBy(deals, (d) => d.source_id, { topN: 6, labelFn: sourceLabel, keepBlank: true }),
    byAgent: countBy(deals, (d) => d.assigned_by_id, { topN: 10, labelFn: agentLabel, keepBlank: true }),
    byFaculty: countBy(deals, (d) => d.faculty, { topN: 10 }),
    byLevel: countBy(deals, (d) => d.level, { keepBlank: true }),
    byPeriod: countBy(deals, (d) => d.basvuru_donemi, { topN: 10 }),
    byRegion: countBy(deals, (d) => d.bolge, { topN: 10 }),
    byCampaign: countBy(deals, (d) => d.ad_campaign, { topN: 8 }),
    negReasons: negativeReasons(deals),
    actByProvider: countBy(activities, (a) => a.provider_id, { labelFn: activityProviderLabel, keepBlank: true }),
    actByDirection: countBy(activities, (a) => a.direction, { labelFn: directionLabel, keepBlank: true }),
    actByResponsible: countBy(activities, (a) => a.responsible_id, { topN: 10, labelFn: agentLabel, keepBlank: true }),
    actOverTime: timeSeries(activities, 'created'),
  }
}

// Distinct, sorted values for a field — used to populate filter dropdowns.
export function distinctValues(rows, field) {
  const set = new Set()
  for (const r of rows) {
    if (!isBlank(r[field])) set.add(r[field])
  }
  return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)))
}
