import { agentLabel, stageLabel, stageSemanticLabel, dealOutcome, sourceLabel } from './labels.js'

const isBlank = (v) => v == null || v === '' || v === '(null)'

// Every dimension the dashboard can be filtered by. `key` is the filter-state
// key; `field` is the deal column; `labelFn` renders coded values.
export const FILTER_FIELDS = [
  { key: 'stage', field: 'stage_semantic', label: 'Outcome', type: 'stage' },
  { key: 'stage_id', field: 'stage_id', label: 'Pipeline stage', labelFn: stageLabel },
  { key: 'country', field: 'country', label: 'Country' },
  { key: 'nationality', field: 'student_nationality', label: 'Nationality' },
  { key: 'level', field: 'level', label: 'Level' },
  { key: 'period', field: 'basvuru_donemi', label: 'Application period' },
  { key: 'agent', field: 'assigned_by_id', label: 'Assigned agent', labelFn: agentLabel },
  { key: 'source', field: 'source_id', label: 'Source', labelFn: sourceLabel },
  { key: 'faculty', field: 'faculty', label: 'Faculty' },
  { key: 'program', field: 'program', label: 'Program' },
  { key: 'region', field: 'bolge', label: 'Region' },
  { key: 'campaign', field: 'ad_campaign', label: 'Ad campaign' },
  { key: 'whatsapp', field: 'contacted_whatsapp', label: 'WhatsApp', type: 'bool' },
]

export const EMPTY_FILTERS = { from: '', to: '', search: '' }
for (const f of FILTER_FIELDS) EMPTY_FILTERS[f.key] = ''

// Build {value,label} option lists for each dimension from the data.
export function buildFilterOptions(deals) {
  const opts = {}
  for (const f of FILTER_FIELDS) {
    if (f.type === 'stage') {
      opts[f.key] = ['P', 'S', 'F'].map((v) => ({ value: v, label: stageSemanticLabel(v) }))
      continue
    }
    if (f.type === 'bool') {
      opts[f.key] = [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ]
      continue
    }
    const set = new Set()
    for (const d of deals) if (!isBlank(d[f.field])) set.add(String(d[f.field]))
    const arr = Array.from(set, (v) => ({ value: v, label: f.labelFn ? f.labelFn(v) : v }))
    arr.sort((a, b) => a.label.localeCompare(b.label))
    opts[f.key] = arr
  }
  return opts
}

const SEARCH_FIELDS = ['student_name', 'country', 'program', 'faculty', 'student_nationality']

// Apply the full filter set to the deals array.
export function applyDealFilters(deals, filters) {
  const fromT = filters.from ? new Date(filters.from + 'T00:00:00').getTime() : null
  const toT = filters.to ? new Date(filters.to + 'T23:59:59').getTime() : null
  const q = (filters.search || '').trim().toLowerCase()

  return deals.filter((d) => {
    for (const f of FILTER_FIELDS) {
      const val = filters[f.key]
      if (!val) continue
      if (f.type === 'stage') {
        if (dealOutcome(d) !== val) return false
      } else if (f.type === 'bool') {
        const yes = d[f.field] === true
        if ((val === 'yes') !== yes) return false
      } else {
        if (String(d[f.field] ?? '') !== val) return false
      }
    }
    if (fromT || toT) {
      const t = d.date_create ? new Date(d.date_create).getTime() : NaN
      if (isNaN(t)) return false
      if (fromT && t < fromT) return false
      if (toT && t > toT) return false
    }
    if (q) {
      const hit = SEARCH_FIELDS.some((k) => String(d[k] || '').toLowerCase().includes(q))
      if (!hit) return false
    }
    return true
  })
}

// Count active (non-empty) filters for the UI badge.
export function countActive(filters) {
  let n = 0
  if (filters.from) n++
  if (filters.to) n++
  if (filters.search) n++
  for (const f of FILTER_FIELDS) if (filters[f.key]) n++
  return n
}
