import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import { fetchDeals, fetchActivities, fetchStageHistory, fetchLastSync, excludeAutomatedEmails } from '../lib/data.js'
import { getCached, setCached, isFresh } from '../lib/cache.js'
import { useT, LANGS } from '../lib/i18n.jsx'
import { funnelVelocity } from '../lib/funnel.js'
import { computeKpis, buildCharts, enrichActivities } from '../lib/aggregations.js'
import { EMPTY_FILTERS, buildFilterOptions, applyDealFilters, countActive } from '../lib/filters.js'
import {
  buildDealActivityIndex,
  agentScorecard,
  speedToLead,
  leadHygiene,
  applicationFunnel,
} from '../lib/advanced.js'
import { KpiRow } from './Kpi.jsx'
import Filters from './Filters.jsx'
import { ChartCard, AreaTrend, HBar, Donut, StageBars } from './Charts.jsx'
import Pipeline from './Pipeline.jsx'
import FunnelVelocity from './FunnelVelocity.jsx'
import ActivityLog from './ActivityLog.jsx'
import AgentScorecard from './AgentScorecard.jsx'
import EntityDetail from './EntityDetail.jsx'
import SourceROI from './SourceROI.jsx'
import LeadHygiene from './LeadHygiene.jsx'
import AskAI from './AskAI.jsx'
import AiInsights from './AiInsights.jsx'
import PriorityLeads from './PriorityLeads.jsx'
import UsersAdmin from './UsersAdmin.jsx'
import { fetchMyPermission, scopeRows, isAdmin, hasPerm } from '../lib/perms.js'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'team', label: 'Team' },
  { key: 'sources', label: 'Sources' },
  { key: 'leadops', label: 'Lead Ops' },
  { key: 'activity', label: 'Activity' },
]

const svg = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{p}</svg>
)
const ICONS = {
  overview: svg(<><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></>),
  pipeline: svg(<path d="M22 12h-4l-3 9L9 3l-3 9H2" />),
  team: svg(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></>),
  sources: svg(<><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></>),
  leadops: svg(<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>),
  activity: svg(<path d="M2 12h4l3 8 4-16 3 8h6" />),
}

export default function Dashboard({ session }) {
  const { t, lang, setLang } = useT()
  const [rawDeals, setDeals] = useState([])
  const [rawActivities, setActivities] = useState([])
  const [perm, setPerm] = useState(null)
  const [progress, setProgress] = useState({ deals: 0, dealsTotal: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [tab, setTab] = useState('overview')
  const [stageHistory, setStageHistory] = useState([])
  const [shLoading, setShLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastSync, setLastSync] = useState(null)
  const [drill, setDrill] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Turn a clicked chart segment into a drill-down (skips aggregate buckets).
  const drillTo = useCallback(
    (field) => (item) => {
      const key = item?.rawKey
      if (!key || key === '__other__' || key === '(Unspecified)' || key === '(غير محدد)') return
      setDrill({ field, value: key })
    },
    [],
  )

  // Load from local cache instantly, then only hit Supabase if the cache is
  // stale (or force=true from the Refresh button).
  const loadData = useCallback(async (force) => {
    const now = Date.now()
    let haveCache = false
    fetchLastSync().then((ts) => ts && setLastSync(ts)).catch(() => {})

    if (!force) {
      const [cd, ca, cs] = await Promise.all([
        getCached('deals'),
        getCached('activities'),
        getCached('stageHistory'),
      ])
      if (cd?.data && ca?.data) {
        setDeals(cd.data)
        // Filter on read too, so caches written before this fix are corrected.
        setActivities(excludeAutomatedEmails(ca.data))
        setLoading(false)
        haveCache = true
      }
      if (cs?.data) {
        setStageHistory(cs.data)
        setShLoading(false)
      }
      // Everything present and fresh → no network needed.
      if (haveCache && isFresh(cd, now) && isFresh(ca, now) && isFresh(cs, now)) return
    }

    setRefreshing(true)
    if (!haveCache) setLoading(true)
    setError('')
    try {
      const [d, a] = await Promise.all([
        fetchDeals((loaded, total) => setProgress((p) => ({ ...p, deals: loaded, dealsTotal: total }))),
        fetchActivities(),
      ])
      setDeals(d)
      setActivities(a)
      setCached('deals', d, now)
      setCached('activities', a, now)
    } catch (e) {
      if (!haveCache) setError(e.message || 'Failed to load data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }

    // Stage history refreshes in the background (only the Pipeline tab needs it).
    try {
      setShLoading(true)
      const h = await fetchStageHistory()
      setStageHistory(h)
      setCached('stageHistory', h, now)
    } catch {
      /* keep cached stage history if the refresh fails */
    } finally {
      setShLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData(false)
  }, [loadData])

  // Permission scope: load once, then restrict every downstream computation to
  // the agents this user may see (admins/see-all keep everything).
  useEffect(() => {
    fetchMyPermission(session.user?.email).then(setPerm)
  }, [session])

  const deals = useMemo(() => scopeRows(rawDeals, perm, 'assigned_by_id'), [rawDeals, perm])
  const activities = useMemo(() => scopeRows(rawActivities, perm, 'responsible_id'), [rawActivities, perm])

  // Tabs the user is allowed to see (admins see all).
  const visibleTabs = useMemo(() => TABS.filter((tb) => hasPerm(perm, `tab.${tb.key}`)), [perm])
  const canAI = hasPerm(perm, 'feature.ai')
  const canPriority = hasPerm(perm, 'feature.priority')

  // If the current tab is not permitted, jump to the first allowed one.
  useEffect(() => {
    if (!perm) return
    if (tab === 'users') return
    if (!hasPerm(perm, `tab.${tab}`)) {
      const first = visibleTabs[0]?.key
      if (first && first !== tab) setTab(first)
    }
  }, [perm, tab, visibleTabs])

  const options = useMemo(() => buildFilterOptions(deals), [deals])
  const filteredDeals = useMemo(() => applyDealFilters(deals, filters), [deals, filters])

  const filteredActivities = useMemo(() => {
    const fromT = filters.from ? new Date(filters.from + 'T00:00:00').getTime() : null
    const toT = filters.to ? new Date(filters.to + 'T23:59:59').getTime() : null
    if (!fromT && !toT) return activities
    return activities.filter((a) => {
      const t = a.created ? new Date(a.created).getTime() : NaN
      if (isNaN(t)) return false
      if (fromT && t < fromT) return false
      if (toT && t > toT) return false
      return true
    })
  }, [activities, filters])

  const kpis = useMemo(() => computeKpis(filteredDeals, filteredActivities), [filteredDeals, filteredActivities])
  const charts = useMemo(() => buildCharts(filteredDeals, filteredActivities), [filteredDeals, filteredActivities])

  const actIndex = useMemo(() => buildDealActivityIndex(activities), [activities])
  const scorecard = useMemo(() => agentScorecard(filteredDeals, filteredActivities, actIndex), [filteredDeals, filteredActivities, actIndex])
  const speed = useMemo(() => speedToLead(filteredDeals, actIndex), [filteredDeals, actIndex])
  const hygiene = useMemo(() => leadHygiene(filteredDeals, actIndex), [filteredDeals, actIndex])
  const appFunnel = useMemo(() => applicationFunnel(filteredDeals), [filteredDeals])

  const funnel = useMemo(() => {
    if (stageHistory.length === 0) return null
    const ids = new Set(filteredDeals.map((d) => Number(d.id)))
    return funnelVelocity(stageHistory, ids)
  }, [stageHistory, filteredDeals])

  const enrichedActivities = useMemo(() => {
    const byId = new Map()
    for (const d of deals) byId.set(Number(d.id), d)
    return enrichActivities(activities, byId)
  }, [deals, activities])

  const activeFilters = countActive(filters)

  // Compact aggregated context handed to the local LLM for insights / briefing.
  const aiContext = useMemo(() => {
    const k = kpis
    const top = (arr, n = 6) => (arr || []).slice(0, n).map((d) => `${d.name} ${d.value}`).join(', ')
    const lines = [
      `Scope: ${filteredDeals.length} of ${deals.length} leads${activeFilters ? ' (filters applied)' : ''}.`,
      `Leads ${k.total}; in-progress ${k.inProgress}; applications ${k.won}; lost ${k.lost}.`,
      `Lead→Application ${k.appRate.toFixed(1)}%; Application→Completed ${k.complRate.toFixed(1)}%.`,
      `Leads last 30 days ${k.last30}; WhatsApp-contacted ${k.whatsapp}; countries ${k.countries}.`,
      `Activities ${k.actTotal} (completed ${k.actDonePct.toFixed(0)}%).`,
      `Top sources: ${top(charts.bySource)}.`,
      `Top countries: ${top(charts.byCountry)}.`,
      `By level: ${top(charts.byLevel)}.`,
    ]
    if (tab === 'team') lines.push(`Leads per agent: ${top(charts.byAgent, 10)}.`)
    if (tab === 'sources') lines.push(`Campaigns: ${top(charts.byCampaign, 8)}.`)
    if (tab === 'pipeline') lines.push(`Pipeline stages: ${top(charts.pipeline, 12)}.`)
    if (tab === 'activity') lines.push(`Activity by channel: ${top(charts.actByProvider, 8)}.`)
    return lines.join('\n')
  }, [tab, kpis, charts, filteredDeals.length, deals.length, activeFilters])

  const aiKey = `${tab}|${filteredDeals.length}|${activeFilters}`

  if (loading) {
    const dp = progress.dealsTotal ? Math.round((progress.deals / progress.dealsTotal) * 100) : 0
    return (
      <div className="center-screen login-bg">
        <div className="loading-box">
          <div className="spinner" />
          <p>{t('Loading data…')}</p>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${dp}%` }} />
          </div>
          <span className="muted">
            {progress.deals.toLocaleString('en-US')} / {progress.dealsTotal.toLocaleString('en-US')} {t('leads')}
          </span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="center-screen login-bg">
        <div className="loading-box">
          <h2>{t('Something went wrong')}</h2>
          <p className="login-error" style={{ maxWidth: 460 }}>{error}</p>
          <button onClick={() => window.location.reload()}>{t('Retry')}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="side-logo">
          <img src={`${import.meta.env.BASE_URL}images/medipol-logo.png`} alt="Istanbul Medipol University" />
          <div className="side-nm">Analytics<span>Istanbul Medipol</span></div>
        </div>
        <div className="side-sec">{t('Workspace')}</div>
        <nav className="side-nav">
          {visibleTabs.map((tb) => (
            <button
              key={tb.key}
              className={`side-item ${tab === tb.key ? 'on' : ''}`}
              onClick={() => { setTab(tb.key); setSidebarOpen(false) }}
            >
              {ICONS[tb.key]}
              <span>{t(tb.label)}</span>
            </button>
          ))}
        </nav>
        {hasPerm(perm, 'admin.users') && (
          <>
            <div className="side-sec">{t('Admin')}</div>
            <nav className="side-nav">
              <button
                className={`side-item ${tab === 'users' ? 'on' : ''}`}
                onClick={() => { setTab('users'); setSidebarOpen(false) }}
              >
                {ICONS.team}
                <span>{t('Users & roles')}</span>
              </button>
            </nav>
          </>
        )}
        <div className="side-foot">
          <div className="side-user">
            <span className="side-ava">{(session.user?.email || 'U').charAt(0).toUpperCase()}</span>
            <span className="side-who">
              <b>{session.user?.email?.split('@')[0]}</b>
              <span>{session.user?.email}</span>
            </span>
          </div>
          <button className="side-signout" onClick={() => supabase.auth.signOut()}>
            {t('Sign out')}
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="side-backdrop" onClick={() => setSidebarOpen(false)} />}

      <div className="app-main">
        <header className="topbar">
          <button className="side-toggle" onClick={() => setSidebarOpen(true)} aria-label="Menu">☰</button>
          <div className="page-title">
            <h1>{tab === 'users' ? t('Users & roles') : t(TABS.find((x) => x.key === tab)?.label || 'Overview')}</h1>
            <span className="muted page-meta">
              {filteredDeals.length.toLocaleString('en-US')} / {deals.length.toLocaleString('en-US')} {t('leads')}
              {activeFilters > 0 ? ` · ${activeFilters} ${t('filters')}` : ''}
            </span>
          </div>
          <div className="topbar-right">
            <div className="lang-switch">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  className={lang === l.code ? 'on' : ''}
                  onClick={() => setLang(l.code)}
                  title={l.name}
                >
                  {l.label}
                </button>
              ))}
            </div>
            {lastSync && (
              <span className="muted sync-note" title={new Date(lastSync).toString()}>
                {t('Data as of')} {new Date(lastSync).toLocaleString('en-GB', { timeZone: 'Europe/Istanbul', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}
              </span>
            )}
            <button className="btn-ghost" onClick={() => loadData(true)} disabled={refreshing}>
              {refreshing ? t('Refreshing…') : `↻ ${t('Refresh')}`}
            </button>
          </div>
        </header>

      <main className="content">
        {tab === 'users' ? (
          <UsersAdmin language={lang} />
        ) : (
        <>
        {tab === 'overview' && canAI && (
          <AiInsights kind="briefing" context={aiContext} cacheKey={`brief|${deals.length}`} language={lang} />
        )}

        <Filters
          options={options}
          value={filters}
          onChange={setFilters}
          onReset={() => setFilters(EMPTY_FILTERS)}
        />

        <KpiRow kpis={kpis} />

        {canAI && <AiInsights kind="insights" context={aiContext} cacheKey={aiKey} language={lang} />}

        {tab === 'overview' && (
          <div className="grid" style={{ marginTop: 16 }}>
            <ChartCard title="Leads over time" subtitle="by creation date" wide>
              <AreaTrend data={charts.dealsOverTime} color="#298de5" />
            </ChartCard>
            <ChartCard title="By source">
              <Donut data={charts.bySource} onSelect={drillTo('source')} />
            </ChartCard>
            <ChartCard title="Top countries">
              <HBar data={charts.byCountry} onSelect={drillTo('country')} />
            </ChartCard>
            <ChartCard title="Top nationalities">
              <HBar data={charts.byNationality} onSelect={drillTo('nationality')} />
            </ChartCard>
            <ChartCard title="By faculty">
              <HBar data={charts.byFaculty} onSelect={drillTo('faculty')} />
            </ChartCard>
            <ChartCard title="By level">
              <Donut data={charts.byLevel} onSelect={drillTo('level')} />
            </ChartCard>
            <ChartCard title="By application period">
              <HBar data={charts.byPeriod} onSelect={drillTo('period')} />
            </ChartCard>
            <ChartCard title="By region" subtitle="bölge">
              <HBar data={charts.byRegion} onSelect={drillTo('region')} />
            </ChartCard>
            <ChartCard title="Rejection reasons">
              <HBar data={charts.negReasons} />
            </ChartCard>
          </div>
        )}

        {tab === 'pipeline' && (
          <>
          <div className="card scorecard" style={{ marginTop: 16 }}>
            <div className="chart-head">
              <h3>{t('Application funnel')}</h3>
              <span className="chart-sub">applied → completed → registered</span>
            </div>
            <div className="log-stats">
              <div className="stat">
                <span className="stat-v" style={{ color: '#22c55e' }}>{appFunnel.applications.toLocaleString('en-US')}</span>
                <span className="stat-l">{t('Applications')}</span>
              </div>
              <div className="stat">
                <span className="stat-v" style={{ color: '#16a34a' }}>{appFunnel.completed.toLocaleString('en-US')}</span>
                <span className="stat-l">{t('Completed')} · {appFunnel.completionRate.toFixed(1)}%</span>
              </div>
              <div className="stat">
                <span className="stat-v" style={{ color: '#15803d' }}>{appFunnel.registered.toLocaleString('en-US')}</span>
                <span className="stat-l">{t('Registration completed')}</span>
              </div>
            </div>
          </div>
          <div className="grid" style={{ marginTop: 16 }}>
            <ChartCard title="Pipeline by stage" subtitle="full funnel" wide height={360}>
              <Pipeline data={charts.pipeline} />
            </ChartCard>
            <ChartCard title="By outcome" subtitle="in progress / won / lost">
              <StageBars data={charts.byStage} />
            </ChartCard>
            <div className="span-2" style={{ gridColumn: '1 / -1' }}>
              <FunnelVelocity data={funnel} loading={shLoading} />
            </div>
          </div>
          </>
        )}

        {tab === 'team' && (
          <>
            <div style={{ marginTop: 16 }}>
              <AgentScorecard rows={scorecard} onSelect={(id) => setDrill({ field: 'agent', value: id })} />
            </div>
            <div className="grid" style={{ marginTop: 16 }}>
              <ChartCard title="Leads by assigned agent">
                <HBar data={charts.byAgent} onSelect={drillTo('agent')} />
              </ChartCard>
              <ChartCard title="Activities by responsible">
                <HBar data={charts.actByResponsible} />
              </ChartCard>
            </div>
          </>
        )}

        {tab === 'sources' && (
          <>
            <div style={{ marginTop: 16 }}>
              <SourceROI deals={filteredDeals} />
            </div>
            <div className="grid" style={{ marginTop: 16 }}>
              <ChartCard title="By source">
                <Donut data={charts.bySource} onSelect={drillTo('source')} />
              </ChartCard>
              <ChartCard title="Top ad campaigns">
                <HBar data={charts.byCampaign} onSelect={drillTo('campaign')} />
              </ChartCard>
            </div>
          </>
        )}

        {tab === 'leadops' && (
          <>
            {canPriority && <PriorityLeads deals={filteredDeals} actIndex={actIndex} language={lang} />}
            <div style={{ marginTop: 16 }}>
              <LeadHygiene hygiene={hygiene} speed={speed} />
            </div>
          </>
        )}

        {tab === 'activity' && (
          <>
            <div className="grid" style={{ marginTop: 16 }}>
              <ChartCard title="Activities over time" wide>
                <AreaTrend data={charts.actOverTime} color="#6366f1" />
              </ChartCard>
              <ChartCard title="By type / source" subtitle="provider">
                <Donut data={charts.actByProvider} />
              </ChartCard>
              <ChartCard title="By direction" subtitle="incoming / outgoing">
                <Donut data={charts.actByDirection} />
              </ChartCard>
            </div>
            <div style={{ marginTop: 16 }}>
              <ActivityLog activities={enrichedActivities} />
            </div>
          </>
        )}

        <footer className="foot muted">
          Data from Supabase · tables <code>bitrix_deals</code> and <code>bitrix_activities</code>
        </footer>
        </>
        )}
      </main>
      </div>

      {canAI && <AskAI deals={deals} activities={enrichedActivities} />}

      {drill && (
        <EntityDetail
          field={drill.field}
          value={drill.value}
          deals={deals}
          enrichedActivities={enrichedActivities}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
  )
}
