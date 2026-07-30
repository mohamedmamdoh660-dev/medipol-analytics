import { supabase } from '../supabase.js'

const PAGE = 1000 // PostgREST default max rows per request

const DEAL_COLUMNS = [
  'id',
  'stage_semantic',
  'stage_id',
  'source_id',
  'country',
  'student_name',
  'student_nationality',
  'assigned_by_id',
  'faculty',
  'program',
  'level',
  'basvuru_donemi',
  'bolge',
  'date_create',
  'registration_date',
  'contacted_whatsapp',
  'lead_source',
  'ad_campaign',
  'neg_reason_mio',
  'neg_reason_mebis',
  'neg_reason_contact_failed',
  'neg_reason_unqualified',
  'neg_reason_lead_lost',
].join(',')

const ACTIVITY_COLUMNS = [
  'id',
  'owner_id',
  'provider_id',
  'subject',
  'direction',
  'completed',
  'created',
  'start_time',
  'responsible_id',
  'type_id',
].join(',')

// Fetches every row of a table in parallel pages, reporting progress.
async function fetchAll(table, columns, onProgress) {
  const { count, error: countError } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })

  if (countError) throw countError
  const total = count || 0
  if (total === 0) return []

  const pages = Math.ceil(total / PAGE)
  const rows = new Array(total)
  let loaded = 0

  // Run pages in small concurrent batches to stay responsive without hammering.
  const BATCH = 4
  for (let start = 0; start < pages; start += BATCH) {
    const batch = []
    for (let p = start; p < Math.min(start + BATCH, pages); p++) {
      const from = p * PAGE
      const to = Math.min(from + PAGE - 1, total - 1)
      batch.push(
        supabase
          .from(table)
          .select(columns)
          .order('id', { ascending: true })
          .range(from, to)
          .then(({ data, error }) => {
            if (error) throw error
            for (let i = 0; i < data.length; i++) rows[from + i] = data[i]
            loaded += data.length
            if (onProgress) onProgress(loaded, total)
          }),
      )
    }
    await Promise.all(batch)
  }

  return rows.filter(Boolean)
}

export async function fetchDeals(onProgress) {
  return fetchAll('bitrix_deals', DEAL_COLUMNS, onProgress)
}

// Automated welcome emails are sent by the CRM under an employee's account but
// are NOT employee work — they must be excluded from every activity metric.
// They are identified by their fixed subject (filtering by author is unreliable:
// the same subjects reach both real and automated emails). See analysis:
// 30,118 automated welcome/test emails vs 588 real employee emails.
// Inbound system noise (bounces / delivery notifications / auto-replies) — not
// genuine student emails, so excluded from "emails received" and all counts.
const SYSTEM_EMAIL_SUBJECTS = [
  'delivery status notification',
  'undeliverable',
  'spf violation',
  'mail delivery failed',
  'returned mail',
  'automatic reply',
  'out of office',
]

export function isAutomatedEmail(a) {
  if (!a || a.provider_id !== 'CRM_EMAIL') return false
  if (!(a.direction === 2 || a.direction === '2')) return false
  const s = String(a.subject || '').trim().toLowerCase()
  if (s.includes('test auto email')) return true
  // A reply/forward keeps the welcome subject ("Re: Your Future…") but is REAL
  // employee work — never exclude those.
  if (s.startsWith('re:') || s.startsWith('fwd:') || s.startsWith('fw:')) return false
  // Otherwise, the original automated welcome blast.
  return s.includes('your future at istanbul medipol university')
}

// Any non-genuine email: automated outbound welcome/test, or inbound bounces.
export function isNoiseEmail(a) {
  if (!a || a.provider_id !== 'CRM_EMAIL') return false
  if (isAutomatedEmail(a)) return true
  const s = String(a.subject || '').toLowerCase()
  return SYSTEM_EMAIL_SUBJECTS.some((p) => s.includes(p))
}

export function excludeAutomatedEmails(activities) {
  return activities.filter((a) => !isNoiseEmail(a))
}

export async function fetchActivities(onProgress) {
  const all = await fetchAll('bitrix_activities', ACTIVITY_COLUMNS, onProgress)
  return excludeAutomatedEmails(all)
}

export async function fetchStageHistory(onProgress) {
  return fetchAll('bitrix_stage_history', 'owner_id,stage_id,created_time', onProgress)
}

// Latest sync timestamp — shows how fresh the data is.
export async function fetchLastSync() {
  const { data } = await supabase
    .from('bitrix_deals')
    .select('synced_at')
    .order('synced_at', { ascending: false })
    .limit(1)
  return data?.[0]?.synced_at || null
}
