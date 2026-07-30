// Fast, explainable lead prioritisation — no per-row LLM calls.
// Ranks in-progress leads by (conversion potential) + (need-to-act urgency)
// using signals we already have: source/country conversion, stage progress,
// last outreach recency, and WhatsApp contact.
import { dealOutcome, stageMeta, sourceLabel } from './labels.js'

const DAY = 86400000

export function priorityLeads(deals, actIndex, nowMs, topN = 25) {
  const srcAgg = new Map()
  const cntAgg = new Map()
  let maxOrder = 1

  for (const d of deals) {
    const o = dealOutcome(d)
    const s = d.source_id || '—'
    const c = d.country || '—'
    const sa = srcAgg.get(s) || { won: 0, n: 0 }
    sa.n++; if (o === 'S') sa.won++; srcAgg.set(s, sa)
    const ca = cntAgg.get(c) || { won: 0, n: 0 }
    ca.n++; if (o === 'S') ca.won++; cntAgg.set(c, ca)
    const m = stageMeta(d.stage_id)
    if (m.kind === 'progress') maxOrder = Math.max(maxOrder, m.order)
  }
  const rate = (agg, k) => {
    const a = agg.get(k)
    return a && a.n >= 5 ? a.won / a.n : 0 // ignore tiny samples
  }

  const rows = []
  for (const d of deals) {
    if (dealOutcome(d) !== 'P') continue // only leads still open
    const m = stageMeta(d.stage_id)
    const sr = rate(srcAgg, d.source_id || '—')
    const cr = rate(cntAgg, d.country || '—')
    const stageProg = m.kind === 'progress' ? m.order / maxOrder : 0.5
    const e = actIndex.get(Number(d.id))
    const contacted = !!(e && e.outCount > 0)
    const lastOut = e && e.outLast > 0 ? e.outLast : null
    const daysSince = lastOut ? Math.floor((nowMs - lastOut) / DAY) : null
    const wa = d.contacted_whatsapp === true

    const potential = 0.4 * sr + 0.25 * cr + 0.25 * stageProg + 0.1 * (wa ? 1 : 0)

    let urgency
    const reasons = []
    if (!contacted) { urgency = 0.9; reasons.push('never-contacted') }
    else if (daysSince == null) urgency = 0.4
    else if (daysSince >= 3) { urgency = Math.min(1, 0.5 + daysSince / 60); if (daysSince <= 60) reasons.push('stalling') }
    else urgency = 0.25

    const score = Math.round((potential * 0.65 + urgency * 0.35) * 100)
    if (sr >= 0.05) reasons.push('good-source')
    if (cr >= 0.05) reasons.push('good-country')
    if (m.kind === 'progress' && stageProg >= 0.6) reasons.push('advanced-stage')
    if (wa) reasons.push('whatsapp')

    rows.push({
      id: d.id,
      name: d.student_name || `#${d.id}`,
      country: d.country || '—',
      source: sourceLabel(d.source_id),
      stage: m.label,
      agentId: d.assigned_by_id,
      score,
      daysSince,
      contacted,
      reasons,
      sr: Math.round(sr * 1000) / 10,
      cr: Math.round(cr * 1000) / 10,
    })
  }
  rows.sort((a, b) => b.score - a.score)
  return rows.slice(0, topN)
}

// Compact context string for the LLM to summarise the priority list.
export function priorityContext(rows) {
  const lines = rows.slice(0, 12).map(
    (r) =>
      `${r.name} — ${r.country}, ${r.source}, stage ${r.stage}, ` +
      `${r.contacted ? (r.daysSince == null ? 'contacted' : r.daysSince + 'd since outreach') : 'never contacted'}, ` +
      `score ${r.score}`,
  )
  return `Top priority in-progress leads to act on today:\n${lines.join('\n')}`
}
