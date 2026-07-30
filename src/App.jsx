import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import Login from './components/Login.jsx'
import Dashboard from './components/Dashboard.jsx'

export default function App() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!ready) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    )
  }

  if (!session) {
    return <Login />
  }

  return <Dashboard session={session} />
}
