import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { insertRow, listRows } from './store'
import type { Member } from './types'

interface FamilyCtx {
  familyId: string | null
  familyName: string
  inviteCode: string | null
  me: Member | null
  session: Session | null
  loading: boolean
  refresh: () => Promise<void>
}

const Ctx = createContext<FamilyCtx | null>(null)
const DEMO_FAMILY = 'demo-familie'

async function seedDemo() {
  if (localStorage.getItem('familienplaner:seeded')) return
  localStorage.setItem('familienplaner:seeded', '1')
  const people: Array<Pick<Member, 'name' | 'color' | 'role'>> = [
    { name: 'Mama', color: '#e11d48', role: 'parent' },
    { name: 'Papa', color: '#2563eb', role: 'parent' },
    { name: 'Kind 1', color: '#16a34a', role: 'child' },
  ]
  for (const p of people) await insertRow('members', { ...p, family_id: DEMO_FAMILY })
}

export function FamilyProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [me, setMe] = useState<Member | null>(null)
  const [familyName, setFamilyName] = useState('Familie')
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    if (!supabase) {
      await seedDemo()
      const members = await listRows('members', DEMO_FAMILY)
      setMe(members[0] ?? null)
      setFamilyName('Demo-Familie')
      setLoading(false)
      return
    }
    const { data: s } = await supabase.auth.getSession()
    setSession(s.session)
    if (!s.session) {
      setMe(null)
      setLoading(false)
      return
    }
    const { data: m } = await supabase.from('members').select('*').eq('user_id', s.session.user.id).maybeSingle()
    setMe((m as Member) ?? null)
    if (m) {
      const { data: f } = await supabase.from('families').select('name, invite_code').eq('id', m.family_id).single()
      if (f) {
        setFamilyName(f.name)
        setInviteCode(f.invite_code)
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    void refresh()
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange(() => void refresh())
    return () => data.subscription.unsubscribe()
  }, [])

  return (
    <Ctx.Provider
      value={{ familyId: supabase ? (me?.family_id ?? null) : DEMO_FAMILY, familyName, inviteCode, me, session, loading, refresh }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useFamily() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useFamily außerhalb von FamilyProvider')
  return c
}
