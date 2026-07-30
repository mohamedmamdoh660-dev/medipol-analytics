import { agentLabel, AGENTS, stageSemanticLabel, dealOutcome, sourceLabel } from './labels.js'
import { istanbul, periodAnchors } from './tz.js'

// ---- shared helpers --------------------------------------------------
const DEAL_COL = {
  country: 'country', nationality: 'student_nationality', level: 'level',
  faculty: 'faculty', program: 'program', source: 'source_id', region: 'bolge',
  period: 'basvuru_donemi', campaign: 'ad_campaign', agent: 'assigned_by_id',
}
const norm = (v) => String(v ?? '').trim().toLowerCase()

export function agentIdFromName(name) {
  const n = norm(name)
  for (const [id, label] of Object.entries(AGENTS)) {
    if (norm(label) === n || norm(label).includes(n) || n.includes(norm(label))) return id
  }
  return name
}

// Human activity type + label + whether it's an employee action (outbound).
export function activityType(a) {
  const p = a.provider_id
  const out = a.direction === 2 || a.direction === '2'
  if (p === 'CRM_EMAIL') return out ? 'email_sent' : 'email_received'
  if (p === 'VOXIMPLANT_CALL') return out ? 'call_made' : 'call_received'
  if (p === 'IMOPENLINES_SESSION') return out ? 'chat_sent' : 'chat_received'
  if (p === 'CRM_WEBFORM') return 'webform'
  if (p === 'CRM_TODO') return a.completed ? 'followup_done' : 'followup_open'
  if (p === 'CRM_SMS') return out ? 'sms_sent' : 'sms_received'
  return 'other'
}
const TYPE_LABEL = {
  email_sent: 'Emails sent', email_received: 'Emails received',
  call_made: 'Calls made', call_received: 'Calls received',
  chat_sent: 'Chats sent', chat_received: 'Chats received',
  webform: 'Web forms', followup_done: 'Follow-ups done', followup_open: 'Follow-ups open',
  sms_sent: 'SMS sent', sms_received: 'SMS received', other: 'Other',
}
const OUTBOUND_TYPES = new Set(['email_sent', 'call_made', 'chat_sent', 'followup_done', 'sms_sent'])

function inPeriod(ts, period) {
  if (!period) return true
  const ist = istanbul(ts)
  if (!ist) return false
  const a = periodAnchors()
  if (period === 'today') return ist.dayKey === a.todayKey
  if (period === 'yesterday') return ist.dayKey === a.yesterdayKey
  if (period === 'last7') return ist.dayKey >= a.last7Key
  if (period === 'last30') return ist.dayKey >= a.last30Key
  return true
}

// ---- deals query -----------------------------------------------------
// Exported as matchField too — used by EntityDetail for entity drill-downs.
export function matchField(deal, field, value) {
  return matchDeal(deal, field, value)
}
function matchDeal(deal, field, value) {
  if (field === 'stage') return dealOutcome(deal) === value
  if (field === 'whatsapp') return (deal.contacted_whatsapp === true) === (norm(value) === 'yes' || norm(value) === 'true')
  const col = DEAL_COL[field]
  if (!col) return true
  if (field === 'agent') return String(deal.assigned_by_id) === String(agentIdFromName(value))
  return norm(deal[col]) === norm(value)
}
function dealGroupKey(deal, field) {
  if (field === 'stage') return stageSemanticLabel(dealOutcome(deal))
  if (field === 'agent') return agentLabel(deal.assigned_by_id)
  if (field === 'source') return sourceLabel(deal.source_id)
  const col = DEAL_COL[field]
  const v = deal[col]
  return v == null || v === '' ? '(Unspecified)' : String(v)
}
function dealMetric(rows, metric) {
  const won = rows.filter((r) => dealOutcome(r) === 'S').length
  const lost = rows.filter((r) => dealOutcome(r) === 'F').length
  const completed = rows.filter((r) => r.stage_id === 'C2:UC_BUY082' || r.stage_id === 'C2:WON').length
  if (metric === 'applications' || metric === 'won') return won
  if (metric === 'lost') return lost
  if (metric === 'completed') return completed
  if (metric === 'conversion') return rows.length ? (won / rows.length) * 100 : 0
  return rows.length
}

// ---- activities query ------------------------------------------------
function matchActivity(a, filters) {
  if (filters.agent && String(a.responsible_id) !== String(agentIdFromName(filters.agent))) return false
  if (filters.period && !inPeriod(a.created, filters.period)) return false
  if (filters.activity_type && activityType(a) !== filters.activity_type) return false
  if (filters.direction) {
    const out = a.direction === 2 || a.direction === '2'
    if ((filters.direction === 'out') !== out) return false
  }
  return true
}
function actGroupKey(a, field) {
  if (field === 'agent') return agentLabel(a.responsible_id)
  if (field === 'activity_type' || field === 'type') return TYPE_LABEL[activityType(a)] || 'Other'
  if (field === 'direction') return a.direction === 2 || a.direction === '2' ? 'Outbound' : 'Inbound'
  return '(all)'
}

// ---- main ------------------------------------------------------------
const isPct = (m) => m === 'conversion'

export function runQuery(deals, activities, spec) {
  const dataset = spec?.dataset === 'activities' ? 'activities' : 'deals'
  const filters = spec?.filters || {}
  const groupBy = spec?.groupBy || null
  const metric = spec?.metric || 'count'

  const filterText = Object.entries(filters).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(', ')

  if (dataset === 'activities') {
    // Only real employee-relevant activities (already filtered upstream); by
    // default count outbound actions unless a type/direction is specified.
    let rows = (activities || []).filter((a) => matchActivity(a, filters))
    if (!filters.activity_type && !filters.direction && metric === 'count' && !groupBy) {
      rows = rows.filter((a) => OUTBOUND_TYPES.has(activityType(a)))
    }
    if (!groupBy) {
      return { kind: 'scalar', metric: 'activities', value: rows.length, count: rows.length, filterText,
        summary: `activities=${rows.length}${filterText ? ' (' + filterText + ')' : ''}` }
    }
    const map = new Map()
    for (const a of rows) {
      const k = actGroupKey(a, groupBy)
      map.set(k, (map.get(k) || 0) + 1)
    }
    let out = Array.from(map, ([name, value]) => ({ name, rawKey: name, value })).sort((x, y) => y.value - x.value).slice(0, 15)
    return { kind: 'grouped', metric: 'activities', groupBy, rows: out, filterText,
      summary: `activities by ${groupBy}: ` + out.slice(0, 8).map((r) => `${r.name}=${r.value}`).join(', ') }
  }

  // deals
  const filtered = deals.filter((d) => Object.entries(filters).every(([f, v]) => (v ? matchDeal(d, f, v) : true)))
  if (!groupBy) {
    const value = dealMetric(filtered, metric)
    return { kind: 'scalar', metric, value, count: filtered.length, filterText,
      summary: `${metric}=${isPct(metric) ? value.toFixed(1) + '%' : value} (n=${filtered.length}${filterText ? ', ' + filterText : ''})` }
  }
  const groups = new Map()
  for (const d of filtered) {
    const k = dealGroupKey(d, groupBy)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(d)
  }
  let rows = Array.from(groups, ([name, arr]) => ({ name, rawKey: name, value: dealMetric(arr, metric), count: arr.length }))
  rows.sort((a, b) => b.value - a.value)
  rows = rows.slice(0, 15)
  return { kind: 'grouped', metric, groupBy, rows, filterText,
    summary: `${metric} by ${groupBy}${filterText ? ' (' + filterText + ')' : ''}: ` +
      rows.slice(0, 8).map((r) => `${r.name}=${isPct(metric) ? r.value.toFixed(1) + '%' : r.value}`).join(', ') }
}
