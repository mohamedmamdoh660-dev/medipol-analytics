import { agentLabel, dealOutcome } from './labels.js'

const isBlank = (v) => v == null || v === '' || v === '(null)'
const ms = (t) => (t ? new Date(t).getTime() : NaN)

// Index activities by their parent deal (owner_id = deal.id):
// { count, first, last } per deal id.
export function buildDealActivityIndex(activities) {
  const idx = new Map()
  for (const a of activities) {
    const key = Number(a.owner_id)
    if (!key) continue
    const t = ms(a.created)
    // direction 2 = outgoing (the agent actually reached out). Inbound webform
    // / email are the student contacting us, so they don't count as "contacted".
    const out = a.direction === 2 || a.direction === '2'
    let e = idx.get(key)
    if (!e) {
      e = { count: 0, first: Infinity, last: -Infinity, outCount: 0, outFirst: Infinity, outLast: -Infinity }
      idx.set(key, e)
    }
    e.count++
    if (!isNaN(t)) {
      if (t < e.first) e.first = t
      if (t > e.last) e.last = t
    }
    if (out) {
      e.outCount++
      if (!isNaN(t)) {
        if (t < e.outFirst) e.outFirst = t
        if (t > e.outLast) e.outLast = t
      }
    }
  }
  return idx
}

// ---- Agent scorecard -------------------------------------------------
// Per assigned agent: leads, won/lost/in-progress, conversion, activities
// done, contacted leads, and average response time to first activity.
export function agentScorecard(deals, activities, index) {
  const rows = new Map()
  const get = (id) => {
    let r = rows.get(id)
    if (!r) {
      r = {
        id,
        name: agentLabel(id),
        leads: 0,
        won: 0,
        lost: 0,
        inProgress: 0,
        completed: 0,
        activities: 0,
        contacted: 0,
        respSum: 0,
        respN: 0,
      }
      rows.set(id, r)
    }
    return r
  }

  for (const d of deals) {
    const id = isBlank(d.assigned_by_id) ? '—' : d.assigned_by_id
    const r = get(id)
    r.leads++
    const o = dealOutcome(d)
    if (o === 'S') r.won++
    else if (o === 'F') r.lost++
    else r.inProgress++
    if (d.stage_id === 'C2:UC_BUY082' || d.stage_id === 'C2:WON') r.completed++

    const act = index.get(Number(d.id))
    if (act && act.outCount > 0) {
      r.contacted++
      const created = ms(d.date_create)
      if (!isNaN(created) && act.outFirst !== Infinity && act.outFirst >= created) {
        r.respSum += act.outFirst - created
        r.respN++
      }
    }
  }

  // Activities are credited to whoever performed them (responsible_id).
  for (const a of activities) {
    if (isBlank(a.responsible_id)) continue
    const r = get(a.responsible_id)
    r.activities++
  }

  const out = Array.from(rows.values()).map((r) => ({
    ...r,
    appRate: r.leads > 0 ? (r.won / r.leads) * 100 : 0, // lead -> application
    complRate: r.won > 0 ? (r.completed / r.won) * 100 : 0, // application -> completed
    contactRate: r.leads > 0 ? (r.contacted / r.leads) * 100 : 0,
    avgRespHrs: r.respN > 0 ? r.respSum / r.respN / 3600000 : null,
  }))
  out.sort((a, b) => b.leads - a.leads)
  return out
}

// ---- Speed to lead ---------------------------------------------------
// Distribution of time-to-first-activity across all contacted leads.
export function speedToLead(deals, index) {
  const buckets = [
    { name: '< 1h', min: 0, max: 1, value: 0 },
    { name: '1–4h', min: 1, max: 4, value: 0 },
    { name: '4–24h', min: 4, max: 24, value: 0 },
    { name: '1–3d', min: 24, max: 72, value: 0 },
    { name: '> 3d', min: 72, max: Infinity, value: 0 },
  ]
  let sum = 0
  let n = 0
  for (const d of deals) {
    const act = index.get(Number(d.id))
    if (!act || act.outFirst === Infinity) continue
    const created = ms(d.date_create)
    if (isNaN(created) || act.outFirst < created) continue
    const hrs = (act.outFirst - created) / 3600000
    sum += hrs
    n++
    const b = buckets.find((x) => hrs >= x.min && hrs < x.max)
    if (b) b.value++
  }
  return { buckets, avgHrs: n > 0 ? sum / n : null, count: n }
}

// ---- Lead hygiene ----------------------------------------------------
// Contacted vs never-contacted, and stale in-progress leads (no activity
// for `staleDays`, measured from last activity or creation date).
export function leadHygiene(deals, index, staleDays = 14) {
  const now = Date.now()
  const cut = staleDays * 24 * 3600000
  let contacted = 0
  let never = 0
  let stale = 0
  const staleByAgent = new Map()
  const oldest = []

  for (const d of deals) {
    const act = index.get(Number(d.id))
    const hasAct = act && act.outCount > 0
    if (hasAct) contacted++
    else never++

    // Only open (in-progress) leads can be "stale".
    if (dealOutcome(d) === 'P') {
      const ref = hasAct && act.outLast > 0 ? act.outLast : ms(d.date_create)
      if (!isNaN(ref) && now - ref > cut) {
        stale++
        const ag = agentLabel(isBlank(d.assigned_by_id) ? '—' : d.assigned_by_id)
        staleByAgent.set(ag, (staleByAgent.get(ag) || 0) + 1)
        oldest.push({
          id: d.id,
          student: d.student_name || '',
          country: d.country || '',
          agent: ag,
          days: Math.floor((now - ref) / 86400000),
          contacted: hasAct,
        })
      }
    }
  }

  oldest.sort((a, b) => b.days - a.days)
  const byAgent = Array.from(staleByAgent, ([name, value]) => ({ name, value })).sort(
    (a, b) => b.value - a.value,
  )
  const total = deals.length || 1
  return {
    contacted,
    never,
    stale,
    contactRate: (contacted / total) * 100,
    byAgent,
    oldest: oldest.slice(0, 50),
  }
}

// ---- Application funnel ---------------------------------------------
// The Pipeline-1 win is "the student applied" (Application Started). Then we
// track how many of those went on to Application Completed, then Registration.
export function applicationFunnel(deals) {
  let applications = 0 // reached Application Started (currently at it or beyond)
  let completed = 0 // reached Application Completed
  let registered = 0 // reached Registration Completed
  for (const d of deals) {
    const s = d.stage_id
    if (s === 'C2:UC_2Z43AG' || s === 'C2:UC_BUY082' || s === 'C2:WON') applications++
    if (s === 'C2:UC_BUY082' || s === 'C2:WON') completed++
    if (s === 'C2:WON') registered++
  }
  return {
    applications,
    completed,
    registered,
    completionRate: applications > 0 ? (completed / applications) * 100 : 0,
  }
}

// ---- Source / campaign ROI ------------------------------------------
// Conversion quality per source value: leads, won, lost, conversion %.
export function sourceRoi(deals, field, topN = 12) {
  const map = new Map()
  for (const d of deals) {
    let k = d[field]
    if (isBlank(k)) k = '(Unspecified)'
    let r = map.get(k)
    if (!r) {
      r = { name: String(k), leads: 0, won: 0, lost: 0 }
      map.set(k, r)
    }
    r.leads++
    const o = dealOutcome(d)
    if (o === 'S') r.won++
    else if (o === 'F') r.lost++
  }
  const out = Array.from(map.values()).map((r) => ({
    ...r,
    conversion: r.leads > 0 ? (r.won / r.leads) * 100 : 0,
  }))
  out.sort((a, b) => b.leads - a.leads)
  return out.slice(0, topN)
}
