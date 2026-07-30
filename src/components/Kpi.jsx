import { useT } from '../lib/i18n.jsx'

function fmt(n) {
  if (n == null || isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US').format(Math.round(n))
}

export function KpiCard({ label, value, suffix = '', accent = 'var(--brand)', hint }) {
  return (
    <div className="kpi">
      <div className="kpi-bar" style={{ background: accent }} />
      <div className="kpi-body">
        <span className="kpi-label">{label}</span>
        <span className="kpi-value">
          {value}
          {suffix && <span className="kpi-suffix">{suffix}</span>}
        </span>
        {hint && <span className="kpi-hint">{hint}</span>}
      </div>
    </div>
  )
}

export function KpiRow({ kpis }) {
  const { t } = useT()
  return (
    <div className="kpi-row">
      <KpiCard label={t('Total leads')} value={fmt(kpis.total)} accent="#298de5" />
      <KpiCard label={t('In progress')} value={fmt(kpis.inProgress)} accent="#3b82f6" />
      <KpiCard label={t('Applications')} value={fmt(kpis.won)} accent="#22c55e" hint={t('Application Started+')} />
      <KpiCard label={t('Lost / Rejected')} value={fmt(kpis.lost)} accent="#dc2626" />
      <KpiCard
        label={t('Lead → Application')}
        value={kpis.appRate.toFixed(1)}
        suffix="%"
        accent="#8b5cf6"
        hint={t('applications ÷ leads')}
      />
      <KpiCard
        label={t('Application → Completed')}
        value={kpis.complRate.toFixed(1)}
        suffix="%"
        accent="#16a34a"
        hint={`${fmt(kpis.completed)} ${t('Completed').toLowerCase()}`}
      />
      <KpiCard label={t('Leads last 30 days')} value={fmt(kpis.last30)} accent="#f59e0b" />
      <KpiCard label={t('WhatsApp contacted')} value={fmt(kpis.whatsapp)} accent="#14b8a6" />
      <KpiCard label={t('Countries')} value={fmt(kpis.countries)} accent="#0ea5e9" />
      <KpiCard label={t('Total activities')} value={fmt(kpis.actTotal)} accent="#6366f1" />
      <KpiCard
        label={t('Completed activities')}
        value={kpis.actDonePct.toFixed(0)}
        suffix="%"
        accent="#84cc16"
        hint={`${fmt(kpis.actDone)} ${t('activities') || 'activities'}`}
      />
    </div>
  )
}
