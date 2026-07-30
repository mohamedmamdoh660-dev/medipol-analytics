import { useRef, useState } from 'react'
import { supabase } from '../supabase.js'
import { useT, LANGS } from '../lib/i18n.jsx'

function Icon({ d, size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d}
    </svg>
  )
}
const shield = <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></>
const spark = <><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" /></>
const arrow = <><path d="M5 12h14M13 6l6 6-6 6" /></>
const lock = <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></>

export default function Login() {
  const { t, lang, setLang } = useT()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bgRef = useRef(null)
  const contentRef = useRef(null)

  function onMove(e) {
    const w = window.innerWidth, h = window.innerHeight
    const dx = (e.clientX / w - 0.5)
    const dy = (e.clientY / h - 0.5)
    if (bgRef.current) bgRef.current.style.transform = `translate(${dx * -12}px, ${dy * -12}px)`
    if (contentRef.current) contentRef.current.style.transform = `translate(${dx * 10}px, ${dy * 10}px)`
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? t('Invalid email or password')
          : error.message,
      )
    }
  }

  return (
    <div className="login-screen" onMouseMove={onMove}>
      <div className="login-bg-img" ref={bgRef} />
      <div className="login-bg-grad" />
      <div className="login-aurora"><span /><span /><span /></div>

      <div className="login-topbar">
        <div className="lang-switch">
          {LANGS.map((l) => (
            <button
              type="button"
              key={l.code}
              className={lang === l.code ? 'on' : ''}
              onClick={() => setLang(l.code)}
            >
              {l.name}
            </button>
          ))}
        </div>
      </div>

      <div className="login-content" ref={contentRef}>
        <div className="login-left">
          <img src={`${import.meta.env.BASE_URL}images/medipol-logo.png`} className="login-logo-img" alt="Istanbul Medipol University" />
          <h1 className="login-hero">
            <span className="login-hero-main">Istanbul Medipol</span>
            <span className="grad">{t('Analytics')}</span>
          </h1>
          <p className="login-sub">
            {t('Your live view of leads, pipeline, agents and sources — one dashboard, any language.')}
          </p>
          <div className="login-trust">
            <span><Icon d={shield} size={14} /> {t('University SSO-ready')}</span>
            <span><Icon d={lock} size={14} /> {t('Encrypted access')}</span>
          </div>
        </div>

        <form className="login-card" onSubmit={onSubmit}>
          <h1>{t('Welcome back')}</h1>
          <p>{t('Sign in to your dashboard')}</p>

          <label>{t('Email')}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@medipol.edu.tr"
            autoComplete="username"
            required
          />

          <label>{t('Password')}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? t('Authenticating…') : <>{t('Access Dashboard')} <Icon d={arrow} /></>}
          </button>
        </form>
      </div>
    </div>
  )
}
