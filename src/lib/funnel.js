import { stageMeta, STAGES } from './labels.js'

// Compute funnel velocity from stage-history rows.
// For each stage: how many distinct deals ever reached it, that as a share of
// all deals, and the average time a deal spent in it before moving on.
// Only current (known) stages are shown in order; retired/legacy stage codes
// are collapsed into a single "Other (legacy stages)" row.
// `allowedIds` (optional Set of deal ids) restricts to the filtered deals.
export function funnelVelocity(history, allowedIds = null) {
  const byDeal = new Map()
  for (const h of history) {
    if (allowedIds && !allowedIds.has(Number(h.owner_id))) continue
    let arr = byDeal.get(h.owner_id)
    if (!arr) {
      arr = []
      byDeal.set(h.owner_id, arr)
    }
    arr.push(h)
  }

  const reached = new Map()
  const durSum = new Map()
  const durN = new Map()
  const legacyDeals = new Set()
  let legacyDurSum = 0
  let legacyDurN = 0

  for (const [dealId, arr] of byDeal) {
    arr.sort((a, b) => new Date(a.created_time) - new Date(b.created_time))
    const seen = new Set()
    for (let i = 0; i < arr.length; i++) {
      const s = arr[i].stage_id
      const known = !!STAGES[s]
      if (!seen.has(s)) {
        seen.add(s)
        if (known) reached.set(s, (reached.get(s) || 0) + 1)
        else legacyDeals.add(dealId)
      }
      if (i + 1 < arr.length) {
        const d = new Date(arr[i + 1].created_time) - new Date(arr[i].created_time)
        if (d >= 0) {
          if (known) {
            durSum.set(s, (durSum.get(s) || 0) + d)
            durN.set(s, (durN.get(s) || 0) + 1)
          } else {
            legacyDurSum += d
            legacyDurN += 1
          }
        }
      }
    }
  }

  const totalDeals = byDeal.size || 1

  const stages = Object.keys(STAGES)
    .filter((id) => reached.get(id))
    .map((stageId) => {
      const meta = stageMeta(stageId)
      const n = durN.get(stageId) || 0
      const r = reached.get(stageId) || 0
      return {
        stageId,
        name: meta.label,
        order: meta.order,
        color: meta.color,
        reached: r,
        reachPct: (r / totalDeals) * 100,
        avgDays: n > 0 ? durSum.get(stageId) / n / 86400000 : null,
      }
    })
  stages.sort((a, b) => a.order - b.order)

  if (legacyDeals.size > 0) {
    stages.push({
      stageId: '__legacy__',
      name: 'Other (legacy stages)',
      order: 999,
      color: '#94a3b8',
      reached: legacyDeals.size,
      reachPct: (legacyDeals.size / totalDeals) * 100,
      avgDays: legacyDurN > 0 ? legacyDurSum / legacyDurN / 86400000 : null,
    })
  }

  return { stages, totalDeals }
}
