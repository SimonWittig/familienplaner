import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import { FamilyProvider, useFamily } from './lib/family'
import { supabase } from './lib/supabase'
import { useLocalReminders } from './lib/reminders'
import Heute from './pages/Heute'
import Termine from './pages/Termine'
import Schule from './pages/Schule'
import Todos from './pages/Todos'
import Familie from './pages/Familie'
import { Login, Onboarding } from './pages/Login'
import Datenschutz from './pages/Datenschutz'
import { useLocation } from 'react-router-dom'
import { Component, type ReactNode } from 'react'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="page center">
        <div className="logo">😕</div>
        <p>Da ist etwas schiefgelaufen.</p>
        <p className="muted">{this.state.error.message}</p>
        <button className="btn primary" onClick={() => location.reload()}>Neu laden</button>
      </div>
    )
  }
}

const TABS = [
  { to: '/', icon: '🏠', label: 'Heute' },
  { to: '/termine', icon: '📅', label: 'Termine' },
  { to: '/schule', icon: '📚', label: 'Schule' },
  { to: '/todos', icon: '✅', label: 'ToDos' },
  { to: '/familie', icon: '👨‍👩‍👧‍👦', label: 'Familie' },
]

function Shell() {
  const { loading, session, me } = useFamily()
  const location = useLocation()
  useLocalReminders()
  if (location.pathname === '/datenschutz') return <Datenschutz />
  if (loading) return <div className="page center"><div className="logo">🏡</div></div>
  if (supabase && !session) return <Login />
  if (supabase && !me) return <Onboarding />
  return (
    <>
      <main>
        <Routes>
          <Route path="/" element={<Heute />} />
          <Route path="/termine" element={<Termine />} />
          <Route path="/schule" element={<Schule />} />
          <Route path="/todos" element={<Todos />} />
          <Route path="/familie" element={<Familie />} />
        </Routes>
      </main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end className={({ isActive }) => (isActive ? 'on' : '')}>
            <span className="tab-icon">{t.icon}</span>
            <span>{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <FamilyProvider>
          <Shell />
        </FamilyProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
