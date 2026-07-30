// Local self-hosted LLM (Ollama) client. Calls go through our own backend
// proxy (/api/ai/chat) so the browser never talks to Ollama directly — this
// avoids CORS and keeps the Ollama endpoint internal.
import { supabase } from '../supabase.js'

const AI_URL = `${import.meta.env.BASE_URL}api/ai/chat`
const MODEL = import.meta.env.VITE_OLLAMA_MODEL || 'qwen2.5:14b'

export const aiConfigured = true

const FIELDS = {
  country: 'Country name, e.g. "Egypt", "Afghanistan", "Pakistan"',
  nationality: 'Student nationality, e.g. "Egyptian"',
  stage: 'Outcome, one of: P (in progress), S (won/accepted), F (lost/rejected)',
  level: 'Study level: "Bachelor", "Master", "Associate", "Doctorate"',
  faculty: 'Faculty / school name',
  program: 'Program name',
  source: 'Lead source, e.g. "WEBFORM"',
  region: 'Region (bölge)',
  period: 'Application period',
  campaign: 'Ad campaign name',
  agent: 'Assigned agent full name, e.g. "Necip Kadir"',
  whatsapp: 'Whether contacted on WhatsApp: "yes" or "no"',
}

const SYSTEM = `You convert a question about a university CRM into a compact JSON query.
Return ONLY JSON, no prose. Schema:
{
  "dataset": "deals" | "activities",       // deals = student leads; activities = employee actions (emails/calls/chats)
  "filters": { <field>: <value>, ... },    // omit if none
  "groupBy": <field or null>,
  "metric": "count" | "conversion" | "applications" | "completed" | "won" | "lost",
  "language": "ar" | "en" | "tr"
}
DEALS fields: ${Object.keys(FIELDS).join(', ')} (country/nationality use exact English names; stage = S won / F lost / P in-progress; whatsapp = yes/no).
ACTIVITIES fields: agent (full name), period ("today"|"yesterday"|"last7"|"last30"), activity_type ("email_sent"|"email_received"|"call_made"|"chat_sent"|"chat_received"|"webform"|"followup_done"), direction ("out"|"in").
Rules:
- Questions about EMAILS / CALLS / WHATSAPP / CHATS / "what did <agent> do" / "most active" => dataset "activities".
- Questions about leads / applications / conversion / countries / sources => dataset "deals".
- "applications/قدّم/başvuru" => metric "applications". "conversion/تحويل" => metric "conversion". "accepted/مقبول" => stage "S".
- "this week/الأسبوع" => period "last7"; "this month/الشهر" => "last30"; "today/النهاردة" => "today".
- groupBy for "by X / حسب / لكل / مين" (e.g. agent, activity_type, source, country).
Examples:
Q: "كام إيميل بعت Necip آخر 7 أيام؟" -> {"dataset":"activities","filters":{"agent":"Necip Kadir","activity_type":"email_sent","period":"last7"},"groupBy":null,"metric":"count","language":"ar"}
Q: "who did the most calls?" -> {"dataset":"activities","filters":{"activity_type":"call_made"},"groupBy":"agent","metric":"count","language":"en"}
Q: "conversion rate by source" -> {"dataset":"deals","filters":{},"groupBy":"source","metric":"conversion","language":"en"}
Q: "كام ليد من مصر قدّم؟" -> {"dataset":"deals","filters":{"country":"Egypt"},"groupBy":null,"metric":"applications","language":"ar"}
Q: "what did Ghoufran do this month" -> {"dataset":"activities","filters":{"agent":"Ghoufran Mounir","period":"last30"},"groupBy":"activity_type","metric":"count","language":"en"}`

async function chat(messages, { json = false, timeout = 120000 } = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeout)
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(AI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token || ''}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: false,
        ...(json ? { format: 'json' } : {}),
        keep_alive: '30m',
        options: { temperature: 0 },
      }),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`AI service error ${res.status}`)
    const data = await res.json()
    return data.message?.content || ''
  } finally {
    clearTimeout(t)
  }
}

// Fire-and-forget warm-up so the first real question isn't a cold model load.
export function warmModel() {
  chat([{ role: 'user', content: 'ok' }], { timeout: 90000 }).catch(() => {})
}

export async function questionToSpec(question) {
  const raw = await chat(
    [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: question },
    ],
    { json: true },
  )
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const LANG_NAME = { en: 'English', tr: 'Turkish', ar: 'Arabic' }

// A few sharp, data-grounded insight bullets for the current view.
export async function aiInsights(context, language = 'ar') {
  const lang = LANG_NAME[language] || 'Arabic'
  const raw = await chat([
    {
      role: 'system',
      content:
        `You are a senior CRM/admissions analyst for a university. Given aggregated dashboard numbers, ` +
        `surface the 3 MOST important, non-obvious insights a manager should act on. ` +
        `Write in ${lang}. Output ONLY 3 bullet lines, each starting with "• ", max ~16 words each. ` +
        `Cite concrete numbers. Compare/contrast (best vs worst, unusually high/low). No preamble, no summary line.`,
    },
    { role: 'user', content: context },
  ], { timeout: 90000 })
  return raw
    .split('\n')
    .map((l) => l.replace(/^[•\-\d.]+\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 3)
}

// A short spoken-style daily briefing from Ms. Mira.
export async function aiBriefing(context, language = 'ar') {
  const lang = LANG_NAME[language] || 'Arabic'
  return chat([
    {
      role: 'system',
      content:
        `You are Ms. Mira, a friendly university admissions analytics assistant. ` +
        `Write a SHORT daily briefing in ${lang} (2-3 sentences, warm but professional). ` +
        `Start with a brief greeting, state the key numbers, then flag the single most important thing ` +
        `that needs attention today. Use the numbers given. No bullet points, no preamble.`,
    },
    { role: 'user', content: context },
  ], { timeout: 90000 })
}

// Short activity/conversation summary for one entity (agent / country / source…).
export async function aiEntitySummary(context, language = 'ar') {
  const lang = LANG_NAME[language] || 'Arabic'
  return chat([
    {
      role: 'system',
      content:
        `You are a CRM analyst. Summarise this entity's engagement in ${lang} in 2-3 short sentences: ` +
        `how active they are (channels, volume), how responsive, likely status, and the single best ` +
        `next action. Use the numbers. No preamble, no bullet points.`,
    },
    { role: 'user', content: context },
  ], { timeout: 90000 })
}

export async function narrate(question, resultText, language = 'ar') {
  const langName = language === 'en' ? 'English' : language === 'tr' ? 'Turkish' : 'Arabic'
  return chat([
    {
      role: 'system',
      content: `You are a CRM analyst. Given the user's question and the computed result, answer in ${langName} in ONE short, direct sentence. Use the numbers. No preamble.`,
    },
    { role: 'user', content: `Question: ${question}\nResult data: ${resultText}` },
  ])
}
