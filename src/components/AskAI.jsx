import { useEffect, useRef, useState } from 'react'
import { aiConfigured, warmModel, questionToSpec, narrate } from '../lib/ai.js'
import { runQuery } from '../lib/aiquery.js'
import { HBar } from './Charts.jsx'
import { useT } from '../lib/i18n.jsx'
import Mira from './Mira.jsx'

const SUGGESTIONS = {
  en: [
    'How many emails did Necip send in the last 7 days?',
    'Who did the most calls?',
    'Conversion rate by source',
    'Top countries by number of leads',
  ],
  ar: [
    'كام إيميل بعت Necip آخر 7 أيام؟',
    'مين عمل أكتر مكالمات؟',
    'نسبة التحويل حسب المصدر',
    'أعلى الدول حسب عدد الليدز',
  ],
  tr: [
    'Necip son 7 günde kaç e-posta gönderdi?',
    'En çok kim arama yaptı?',
    'Kaynağa göre dönüşüm oranı',
    'Aday sayısına göre en çok ülke',
  ],
}

function ResultView({ result }) {
  if (!result) return null
  if (result.kind === 'scalar') {
    const v = result.metric === 'conversion' ? result.value.toFixed(1) + '%' : result.value.toLocaleString('en-US')
    return (
      <div className="ai-scalar">
        <span className="ai-scalar-v">{v}</span>
        <span className="ai-scalar-l">{result.metric} · n={result.count.toLocaleString('en-US')}</span>
      </div>
    )
  }
  const data = result.rows.map((r) => ({ name: r.name, value: Math.round(r.value * 10) / 10 }))
  return (
    <div style={{ height: Math.max(140, data.length * 26) }}>
      <HBar data={data} />
    </div>
  )
}

export default function AskAI({ deals, activities }) {
  const { t, lang } = useT()
  const suggestions = SUGGESTIONS[lang] || SUGGESTIONS.en
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [msgs, setMsgs] = useState([])
  const bodyRef = useRef(null)
  const warmed = useRef(false)

  useEffect(() => {
    if (open && !warmed.current) {
      warmed.current = true
      warmModel()
    }
  }, [open])

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [msgs, busy])

  async function ask(q) {
    const question = (q ?? input).trim()
    if (!question || busy) return
    setInput('')
    setMsgs((m) => [...m, { role: 'user', text: question }])
    setBusy(true)
    try {
      const spec = await questionToSpec(question)
      if (!spec) throw new Error('parse')
      const result = runQuery(deals, activities, spec)
      let text = ''
      try {
        text = await narrate(question, result.summary, spec.language || 'ar')
      } catch {
        text = result.summary
      }
      setMsgs((m) => [...m, { role: 'ai', text, result, spec }])
    } catch (e) {
      setMsgs((m) => [
        ...m,
        { role: 'ai', text: t('Could not analyze the question. Try rephrasing or check the AI service.'), error: true },
      ])
    } finally {
      setBusy(false)
    }
  }

  if (!aiConfigured) return null

  return (
    <>
      {!open && (
        <button className="mira-launcher" onClick={() => setOpen(true)} title="Ms. Mira" aria-label="Ms. Mira">
          <Mira size="fab" greet greetText={t('Hi')} />
        </button>
      )}

      {open && (
        <div className="ai-panel card">
          <div className="ai-head mira-head">
            <Mira size="sm" />
            <div className="mira-id">
              <strong>Ms. Mira</strong>
              <span className="muted">M.I.R.A. · {t('your data assistant')}</span>
            </div>
            <button className="btn-ghost sm" onClick={() => setOpen(false)}>×</button>
          </div>

          <div className="ai-body" ref={bodyRef}>
            {msgs.length === 0 && (
              <div className="ai-welcome">
                <Mira size="lg" />
                <p className="mira-hi">{t('Hi, I’m Mira')} 👋</p>
                <p className="muted">{t('Ask me anything about your data — in any language.')}</p>
                <div className="ai-suggests">
                  {suggestions.map((s) => (
                    <button key={s} onClick={() => ask(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`ai-msg ${m.role}`}>
                <div className={`ai-bubble ${m.error ? 'err' : ''}`}>
                  <div className="ai-text">{m.text}</div>
                  {m.result && <ResultView result={m.result} />}
                </div>
              </div>
            ))}
            {busy && (
              <div className="ai-msg ai">
                <div className="ai-bubble">
                  <span className="ai-typing"><i /><i /><i /></span>
                  <span className="muted" style={{ marginInlineStart: 8, fontSize: 12 }}>
                    {t('Thinking…')}
                  </span>
                </div>
              </div>
            )}
          </div>

          <form
            className="ai-input"
            onSubmit={(e) => {
              e.preventDefault()
              ask()
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('Type your question…')}
              disabled={busy}
            />
            <button type="submit" disabled={busy || !input.trim()}>{t('Send')}</button>
          </form>
        </div>
      )}
    </>
  )
}
