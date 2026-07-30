// All "today / this week / this month / hour-of-day / weekday" logic must use
// the university's local time (Istanbul), not UTC or the viewer's timezone —
// otherwise activity after ~21:00 UTC lands on the wrong day.

const TZ = 'Europe/Istanbul'
const DAY = 86400000
const WEEKDAY_IDX = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
  weekday: 'short',
})

// Returns Istanbul-local parts of a timestamp: { dayKey 'YYYY-MM-DD',
// ym 'YYYY-MM', hour 0-23, weekday 'Mon'…'Sun', wIdx 0(Mon)…6(Sun) }.
export function istanbul(ts) {
  const d = ts instanceof Date ? ts : new Date(ts)
  if (isNaN(d)) return null
  const o = {}
  for (const p of fmt.formatToParts(d)) o[p.type] = p.value
  const dayKey = `${o.year}-${o.month}-${o.day}`
  return {
    dayKey,
    ym: `${o.year}-${o.month}`,
    hour: parseInt(o.hour, 10),
    weekday: o.weekday,
    wIdx: WEEKDAY_IDX[o.weekday] ?? 0,
  }
}

// The current Istanbul period anchors used to bucket activity by period.
// Uses rolling windows: last 7 days and last 30 days (inclusive of today).
export function periodAnchors(nowMs = Date.now()) {
  const today = istanbul(nowMs)
  return {
    todayKey: today.dayKey,
    yesterdayKey: istanbul(nowMs - DAY).dayKey,
    last7Key: istanbul(nowMs - 6 * DAY).dayKey,
    last30Key: istanbul(nowMs - 29 * DAY).dayKey,
  }
}
