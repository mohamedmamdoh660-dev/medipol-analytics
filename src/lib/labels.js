// Human-readable labels for coded Bitrix values.

export const STAGE_SEMANTIC = {
  P: { label: 'In Progress', color: '#3b82f6' },
  S: { label: 'Won / Accepted', color: '#16a34a' },
  F: { label: 'Lost / Rejected', color: '#dc2626' },
}

export function stageSemanticLabel(v) {
  return STAGE_SEMANTIC[v]?.label || 'Unknown'
}

// Activity source (provider_id) labels.
export const ACTIVITY_PROVIDER = {
  CRM_WEBFORM: 'Web form',
  CRM_EMAIL: 'Email',
  CRM_CALL: 'Call',
  IMOPENLINES_SESSION: 'Chat / WhatsApp',
  CRM_TODO: 'Task',
  CRM_SMS: 'SMS',
  REST_APP: 'External app',
}

export function activityProviderLabel(v) {
  return ACTIVITY_PROVIDER[v] || v || 'Unknown'
}

// Activity direction. Bitrix: 1 = incoming, 2 = outgoing.
export function directionLabel(v) {
  if (v === 1 || v === '1') return 'Incoming'
  if (v === 2 || v === '2') return 'Outgoing'
  return 'Unknown'
}

// ============================================================
// Map Bitrix user IDs (assigned_by_id / responsible_id) -> names.
// >>> EDIT THE NAMES BELOW. Every ID that appears in the data is
//     already listed; just replace the value with the real name.
// ============================================================
// Names synced from Bitrix (user.get) on 2026-07-28.
export const AGENTS = {
  '11432': 'Necip Kadir',
  '11430': 'Matin Kolahdouzan',
  '11266': 'Ghoufran Mounir',
  '11268': 'Sudenur Yayla',
  '16254': 'Mohammed Darwish',
  '11270': 'Mekan Tajiyev',
  '16066': 'Sevinj Ibrahimova',
  '15014': 'Mahdiya Arefi',
  '11434': 'Mariam Mughal',
  '11436': 'Shirin Jumabayeva',
  '5056': 'Murat Güney',
  '51': 'Melisa Kaya',
  '13': 'Ferhat Kaya',
  '4764': 'Bitrix Admin',
  '19262': 'Leen Maved',
  '19264': 'Ilaha Khudayeva',
  '19310': 'Gana Hosameldin',
  '19260': 'Samar Jnene',
  '4254': 'Oussama Sedrati',
  '16068': 'Solmaz Azizi',
  '39': 'Dilek Yiğit',
}

export function agentLabel(id) {
  if (id == null || id === '') return 'Unassigned'
  return AGENTS[String(id)] || `User #${id}`
}

// ============================================================
// Pipeline stages (deal category C2). `order` controls the funnel
// order; `kind` controls color (progress / won / lost).
// >>> Rename any label to the real stage name from Bitrix.
// ============================================================
// Stage names + order synced from Bitrix (crm.status.list, DEAL_STAGE_2)
// on 2026-07-27. `kind` drives color and matches the stage semantic.
export const STAGES = {
  'C2:NEW': { label: 'New Lead', order: 10, kind: 'progress' },
  'C2:PREPARATION': { label: 'Follow-up Round 1', order: 20, kind: 'progress' },
  'C2:PREPAYMENT_INVOICE': { label: 'Follow-up Round 2', order: 30, kind: 'progress' },
  'C2:EXECUTING': { label: 'In Conversation', order: 40, kind: 'progress' },
  'C2:15': { label: 'Waiting on Docs', order: 50, kind: 'progress' },
  'C2:UC_2Z43AG': { label: 'Application Started', order: 60, kind: 'won' },
  'C2:UC_BUY082': { label: 'Application Completed', order: 70, kind: 'won' },
  'C2:WON': { label: 'Registration Completed', order: 80, kind: 'won' },
  'C2:LOSE': { label: 'Contact Attempt Failed', order: 90, kind: 'lost' },
  'C2:13': { label: 'Unqualified Lead', order: 100, kind: 'lost' },
  'C2:UC_CB95NN': { label: 'Negative (MIO) Stages', order: 110, kind: 'lost' },
  'C2:UC_MXIBBK': { label: 'Negative MEBİS Stages', order: 120, kind: 'lost' },
  'C2:14': { label: 'Lead Lost', order: 130, kind: 'lost' },
}

// ============================================================
// Outcome definition (Pipeline 1). "Won" = the student reached the
// application phase or beyond. Edit these sets when Pipeline 2 (payment /
// registration) is added, and every KPI/chart updates automatically.
// ============================================================
export const WON_STAGES = new Set([
  'C2:UC_2Z43AG', // Application Started (Başvuru Başlatıldı)
  'C2:UC_BUY082', // Application Completed (Başvuru Tamamlandı)
  'C2:WON', // Registration Completed (Kayıt Tamamlandı)
])
export const LOST_STAGES = new Set([
  'C2:14', // Lead Lost
  'C2:LOSE', // Contact Attempt Failed
  'C2:13', // Unqualified Lead
  'C2:UC_CB95NN', // Negative (MIO)
  'C2:UC_MXIBBK', // Negative MEBİS
])

// Outcome of a deal: 'S' won, 'F' lost, 'P' in progress — driven by the sets
// above, falling back to Bitrix's own stage_semantic for any unmapped stage.
export function dealOutcome(deal) {
  const s = deal.stage_id
  if (WON_STAGES.has(s)) return 'S'
  if (LOST_STAGES.has(s)) return 'F'
  if (deal.stage_semantic === 'S') return 'S'
  if (deal.stage_semantic === 'F') return 'F'
  return 'P'
}

const STAGE_KIND_COLOR = {
  progress: '#3b82f6',
  won: '#16a34a',
  lost: '#dc2626',
}

// Per-stage colors forming a gradient within each group: progress = blues
// deepening toward the win line, won = greens deepening toward final
// registration, lost = reds deepening.
const STAGE_COLOR = {
  'C2:NEW': '#93c5fd',
  'C2:PREPARATION': '#60a5fa',
  'C2:PREPAYMENT_INVOICE': '#3b82f6',
  'C2:EXECUTING': '#2563eb',
  'C2:15': '#1d4ed8',
  'C2:UC_2Z43AG': '#6ee7b7',
  'C2:UC_BUY082': '#22c55e',
  'C2:WON': '#15803d',
  'C2:LOSE': '#fca5a5',
  'C2:13': '#f87171',
  'C2:UC_CB95NN': '#ef4444',
  'C2:UC_MXIBBK': '#dc2626',
  'C2:14': '#b91c1c',
}

export function stageMeta(id) {
  const known = STAGES[id]
  if (known) return { ...known, color: STAGE_COLOR[id] || STAGE_KIND_COLOR[known.kind] || '#64748b' }
  const label = (id || '').replace(/^C\d+:/, '') || 'Unknown'
  return { label, order: 99, kind: 'progress', color: '#94a3b8' }
}

export function stageLabel(id) {
  return stageMeta(id).label
}

// Lead source labels, synced from Bitrix (crm.status.list ENTITY_ID=SOURCE)
// on 2026-07-28. Friendly names for the sources present in our data, plus the
// full Bitrix set so any other value still resolves.
export const SOURCES = {
  WEBFORM: 'CRM Web Form',
  '2|ANK_CHATS_APP24_WHATSAPP': 'WhatsApp',
  'UC_DE9GOZ': 'Fair / Info Form',
  '24|FACEBOOK': 'Facebook',
  '23|TELEGRAM': 'Telegram',
  ADVERTISING: 'Google Ads',
  '3|FACEBOOK': 'Facebook Ads',
  '85': 'Reddit Ads',
  '25': 'TikTok',
  '28': 'Google Ads – WhatsApp',
  '26': 'Ads – Other',
  '4': 'Agency',
  '33': 'Consulate',
  '29': 'Agency – Sales Referral',
  '36': 'Individual Doctor',
  '112|FACEBOOK': 'Facebook Test 2',
  '35': 'Other Hospitals',
  '18|FBINSTAGRAMDIRECT': 'Instagram DM',
  '34': 'Universities',
  '68|FBINSTAGRAMDIRECT': 'Instagram DM (French)',
  '84|FACEBOOK': 'Facebook (Open Channel 43)',
  '70|FBINSTAGRAMDIRECT': 'Instagram DM (Arabic)',
  '76|FACEBOOK': 'Facebook DM (French)',
  '78|FACEBOOK': 'Facebook DM (Arabic)',
  '38': 'Aid Organization',
  '37': 'Fund',
  '32': 'Ministry',
  '24': 'Partner Institutions',
  '40': 'Turkish Insurance',
  '39': 'International Insurance',
  CALL: 'Phone Call',
  EMAIL: 'E-mail',
  WEB: 'Website Form',
  '27': 'Organic – Other',
  '42': 'Other',
  '45': 'HealthTürkiye',
  '46': 'Bookimed',
  '47': 'Platform – Other',
  RECOMMENDATION: 'Referral',
  '6|FBINSTAGRAMDIRECT': 'Instagram DM / Comment',
  '3|FACEBOOKCOMMENTS': 'Facebook Comment',
  '20': 'Influencer',
  '30': 'YouTube',
  '31': 'Social – Other',
  '5': 'Walk-in',
  '43': 'Former Patient',
  '44': 'Ongoing Patient',
  '8': 'Management',
  '21': 'Doctor',
  '41': 'Management – Other',
  STORE: 'Online Store',
  REPEAT_SALE: 'Repeat Sale',
  CALLBACK: 'Callback',
  RC_GENERATOR: 'Billboard',
  BOOKING: 'Booking',
  '23': 'Other',
  'UC_4BO8YN': 'WhatsApp Cloud',
  'UC_0CZGJ0': 'No Value',
}

export function sourceLabel(id) {
  if (id == null || id === '' || id === '(none)') return '(No source)'
  return SOURCES[id] || id
}

// Palette used across categorical charts.
export const PALETTE = [
  '#c0102f', '#3b82f6', '#16a34a', '#f59e0b', '#8b5cf6',
  '#0ea5e9', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
  '#84cc16', '#e11d48', '#06b6d4', '#a855f7', '#eab308',
]
