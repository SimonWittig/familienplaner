import { useState } from 'react'
import { useFamily } from '../lib/family'
import { deleteRow, insertRow, updateRow, useTable } from '../lib/store'
import { enablePush } from '../lib/push'
import { isDemo, supabase } from '../lib/supabase'
import type { Member, Role } from '../lib/types'
import { MemberDot, Sheet } from '../components'
import { GoogleCalendarSection } from './Kalender'

const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#f59e0b', '#9333ea', '#0891b2', '#db2777', '#65a30d']

export default function Familie() {
  const { familyId, familyName, inviteCode, me } = useFamily()
  const { rows: members } = useTable('members', familyId)
  const [editing, setEditing] = useState<Partial<Member> | null>(null)
  const [pushMsg, setPushMsg] = useState<string | null>(null)

  return (
    <div className="page">
      <h1>{familyName}</h1>
      {isDemo && <p className="note">Demo-Modus: Die Daten liegen nur auf diesem Gerät. Mit Supabase werden sie zwischen allen Handys synchronisiert.</p>}

      <h2 className="section">Mitglieder</h2>
      <ul className="list">
        {members.map((m) => (
          <li key={m.id} className="card" onClick={() => setEditing(m)}>
            <MemberDot member={m} />
            <div className="grow">
              <div className="title">{m.name}{m.id === me?.id ? ' (ich)' : ''}</div>
              <div className="sub">{m.role === 'child' ? 'Kind' : 'Elternteil'}{!isDemo && !m.user_id ? ' · noch nicht angemeldet' : ''}</div>
            </div>
          </li>
        ))}
      </ul>
      {isDemo && <button className="btn" onClick={() => setEditing({ role: 'child', color: COLORS[members.length % COLORS.length] })}>+ Mitglied hinzufügen</button>}

      {inviteCode && (
        <>
          <h2 className="section">Familie einladen</h2>
          <p className="muted">Die anderen öffnen die App, melden sich mit Google an und geben diesen Code ein:</p>
          <p className="invite">{inviteCode}</p>
        </>
      )}

      {supabase && (
        <>
          <h2 className="section">Google-Kalender</h2>
          <GoogleCalendarSection />
        </>
      )}

      <h2 className="section">Erinnerungen</h2>
      <button className="btn primary" onClick={async () => me && setPushMsg(await enablePush(me.id))}>🔔 Benachrichtigungen auf diesem Handy aktivieren</button>
      {pushMsg && <p className="note">{pushMsg}</p>}

      {supabase && (
        <>
          <h2 className="section">Konto</h2>
          <button className="btn" onClick={() => void supabase!.auth.signOut()}>Abmelden</button>
        </>
      )}

      {editing && familyId && (
        <MemberForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            if (editing.id) await updateRow('members', editing.id, v)
            else await insertRow('members', { ...v, family_id: familyId } as Omit<Member, 'id'>)
            setEditing(null)
          }}
          onDelete={editing.id && editing.id !== me?.id ? async () => { await deleteRow('members', editing.id!); setEditing(null) } : undefined}
        />
      )}
    </div>
  )
}

function MemberForm({ initial, onSave, onClose, onDelete }: {
  initial: Partial<Member>; onSave: (v: Partial<Member>) => Promise<void>; onClose: () => void; onDelete?: () => Promise<void>
}) {
  const [name, setName] = useState(initial.name ?? '')
  const [color, setColor] = useState(initial.color ?? COLORS[0])
  const [role, setRole] = useState<Role>(initial.role ?? 'child')
  return (
    <Sheet title={initial.id ? 'Mitglied bearbeiten' : 'Neues Mitglied'} onClose={onClose}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); void onSave({ name: name.trim(), color, role }) }}>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <div className="segmented">
          <button type="button" className={role === 'parent' ? 'on' : ''} onClick={() => setRole('parent')}>Elternteil</button>
          <button type="button" className={role === 'child' ? 'on' : ''} onClick={() => setRole('child')}>Kind</button>
        </div>
        <span className="label">Farbe</span>
        <div className="chips">
          {COLORS.map((c) => (
            <button type="button" key={c} className={'swatch' + (c === color ? ' on' : '')} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
          ))}
        </div>
        <div className="row end">
          {onDelete && <button type="button" className="btn danger" onClick={() => void onDelete()}>Entfernen</button>}
          <button className="btn primary">Speichern</button>
        </div>
      </form>
    </Sheet>
  )
}
