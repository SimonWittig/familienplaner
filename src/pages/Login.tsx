import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useFamily } from '../lib/family'

const GOOGLE_SCOPES = 'openid email profile' // Kalenderzugriff wird nur beim Verbinden des Familienkalenders angefragt

export function Login() {
  return (
    <div className="page center">
      <div className="logo">🏡</div>
      <h1>Familienplaner</h1>
      <p className="muted">Termine, Schule und ToDos für die ganze Familie.</p>
      <button
        className="btn primary big"
        onClick={() =>
          void supabase!.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin, scopes: GOOGLE_SCOPES },
          })
        }
      >
        Mit Google anmelden
      </button>
      <a className="muted" href="/datenschutz" style={{ marginTop: 24, fontSize: 13 }}>Datenschutz</a>
    </div>
  )
}

/** Nach dem ersten Login: neue Familie anlegen oder mit Code beitreten. */
export function Onboarding() {
  const { session, refresh } = useFamily()
  const defaultName = (session?.user.user_metadata?.given_name as string) ?? (session?.user.user_metadata?.name as string) ?? ''
  const [name, setName] = useState(defaultName)
  const [familyName, setFamilyName] = useState('')
  const [code, setCode] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const run = async (fn: 'create_family' | 'join_family') => {
    setErr(null)
    const args = fn === 'create_family' ? { family_name: familyName || 'Unsere Familie', my_name: name } : { code: code.trim(), my_name: name }
    const { error } = await supabase!.rpc(fn, args)
    if (error) setErr(error.message)
    else await refresh()
  }

  return (
    <div className="page">
      <h1>Willkommen!</h1>
      <div className="form">
        <span className="label">Dein Name in der App</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Papa oder Lena" />
        <h2 className="section">Familie beitreten</h2>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Einladungscode" />
        <button className="btn primary" disabled={!name || !code} onClick={() => void run('join_family')}>Beitreten</button>
        <h2 className="section">…oder neue Familie anlegen</h2>
        <input value={familyName} onChange={(e) => setFamilyName(e.target.value)} placeholder="z. B. Familie Wittig" />
        <button className="btn" disabled={!name} onClick={() => void run('create_family')}>Familie anlegen</button>
        {err && <p className="note error">{err}</p>}
      </div>
    </div>
  )
}
