import { useEffect, useRef, useState } from 'react'
import { aiConfigured, aiInsights, aiBriefing, aiEntitySummary } from '../lib/ai.js'
import { useT } from '../lib/i18n.jsx'
import Mira from './Mira.jsx'

// Simple in-memory cache so switching tabs doesn't re-hit the model.
const cache = new Map()

export default function AiInsights({ kind = 'insights', context, cacheKey, language = 'ar' }) {
  const { t } = useT()
  const [state, setState] = useState({ loading: false, data: null, error: false })
  const reqId = useRef(0)

  async function run(force) {
    if (!context) return
    const key = `${kind}:${language}:${cacheKey}`
    if (!force && cache.has(key)) {
      setState({ loading: false, data: cache.get(key), error: false })
      return
    }
    const id = ++reqId.current
    setState({ loading: true, data: null, error: false })
    try {
      const data = kind === 'briefing'
        ? await aiBriefing(context, language)
        : kind === 'summary'
          ? await aiEntitySummary(context, language)
          : await aiInsights(context, language)
      if (id !== reqId.current) return
      cache.set(key, data)
      setState({ loading: false, data, error: false })
    } catch {
      if (id !== reqId.current) return
      setState({ loading: false, data: null, error: true })
    }
  }

  useEffect(() => {
    run(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, language, cacheKey, context])

  if (!aiConfigured) return null

  const isText = kind === 'briefing' || kind === 'summary'
  const empty = isText ? !state.data : !(state.data && state.data.length)
  const title = kind === 'briefing' ? t('Today with Mira') : kind === 'summary' ? t('AI summary') : t('AI insights')

  return (
    <div className={`ai-insights ai-${kind}`}>
      <div className="ai-insights-head">
        {kind === 'briefing'
          ? <span className="ai-insights-mira"><Mira size="sm" /></span>
          : <span className="ai-insights-icon">✦</span>}
        <strong>{title}</strong>
        <button
          className="ai-insights-refresh"
          onClick={() => run(true)}
          disabled={state.loading}
          title={t('Regenerate')}
        >
          ↻
        </button>
      </div>

      {state.loading && (
        <div className="ai-insights-loading">
          <span className="ai-typing"><i /><i /><i /></span>
          {t('Mira is analyzing…')}
        </div>
      )}
      {!state.loading && state.error && (
        <div className="ai-insights-err">{t('Could not generate insights right now.')}</div>
      )}
      {!state.loading && !state.error && !empty && (
        isText
          ? <p className="ai-brief-text">{state.data}</p>
          : (
            <ul className="ai-insights-list">
              {state.data.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          )
      )}
    </div>
  )
}
