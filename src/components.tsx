import type { ReactNode } from 'react'
import type { Member } from './lib/types'

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Schließen">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function MemberDot({ member }: { member?: Member | null }) {
  if (!member) return null
  return (
    <span className="member-dot" style={{ background: member.color }} title={member.name}>
      {member.name.slice(0, 1).toUpperCase()}
    </span>
  )
}

export function MemberPicker({
  members, value, onChange, multiple = false,
}: { members: Member[]; value: string[]; onChange: (ids: string[]) => void; multiple?: boolean }) {
  return (
    <div className="chips">
      {members.map((m) => {
        const on = value.includes(m.id)
        return (
          <button
            type="button"
            key={m.id}
            className={'chip' + (on ? ' on' : '')}
            style={on ? { background: m.color, borderColor: m.color } : { borderColor: m.color }}
            onClick={() => onChange(multiple ? (on ? value.filter((v) => v !== m.id) : [...value, m.id]) : on ? [] : [m.id])}
          >
            {m.name}
          </button>
        )
      })}
    </div>
  )
}

export function Fab({ onClick, label }: { onClick: () => void; label: string }) {
  return <button className="fab" onClick={onClick} aria-label={label}>+</button>
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>
}
