import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { LanguageProvider } from './lib/i18n.jsx'
import './styles.css'

// Make public assets referenced from CSS base-path aware (works at "/" in dev
// and under the sub-path, e.g. "/analytics/", in the built app).
const B = import.meta.env.BASE_URL
const rootStyle = document.documentElement.style
rootStyle.setProperty('--img-campus', `url("${B}images/medipol-campus.jpg")`)
rootStyle.setProperty('--img-logo', `url("${B}images/medipol-logo.png")`)
rootStyle.setProperty('--img-mira', `url("${B}mira.png")`)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </React.StrictMode>,
)
