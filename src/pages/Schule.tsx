import { useMemo, useState } from 'react'
import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import { de } from 'date-fns/locale'
import { useFamily } from '../lib/family'
import { deleteRow, insertRow, updateRow, useTable } from '../lib/store'
import { todayStr } from '../lib/recurrence'
import { SCHOOL_KIND_LABEL, type Member, type SchoolItem, type SchoolKind } from '../lib/types'
import { Empty, Fab, MemberDot, MemberPicker, Sheet } from '../components'

export function dueLabel(date: string) {
  const diff = differenceInCalendarDays(parseISO(date), new Date())
  if (diff < 0) return `überfällig (${format(parseISO(date), 'd.M.')})`
  if (diff === 0) return 'heute'
  if (diff === 1) return 'morgen'
  if (diff < 7) return format(parseISO(date), 'EEEE', { locale: de })
  return format(parseISO(date), 'EEE d.M.', { locale: de })
}

export default function Schule() {
  const { familyId, me } = useFamily()
  const { rows: items } = useTable('school_items', familyId)
  const { rows: members } = useTable('members', familyId)
  const [filter, setFilter] = useState<string[]>([])
  const [showDone, setShowDone] = useState(false)
  const [editing, setEditing] = useState<Partial<SchoolItem> | null>(null)

  const children = members.filter((m) => m.role === 'child')
  const visible = useMemo(
    () => items
      .filter((i) => (showDone ? true : !i.done))
      .filter((i) => filter.length === 0 || (i.member_id && filter.includes(i.member_id)))
      .sort((a, b) => a.due_date.localeCompare(b.due_date)),
    [items, filter, showDone],
  )
  const exams = visible.filter((i) => i.kind !== 'hue')
  const hues = visible.filter((i) => i.kind === 'hue')
  const byId = (id?: string | null) => members.find((m) => m.id === id)

  const renderItem = (i: SchoolItem) => (
    <li key={i.id} className={'card' + (i.done ? ' done' : '') + (i.kind !== 'hue' ? ' exam' : '')}>
      <input
        type="checkbox"
        className="check"
        checked={i.done}
        onChange={() => void updateRow('school_items', i.id, { done: !i.done })}
        aria-label="Erledigt"
      />
      <div className="grow" onClick={() => setEditing(i)}>
        <div className="title">{i.subject}{i.title ? `: ${i.title}` : ''}</div>
        <div className="sub">{SCHOOL_KIND_LABEL[i.kind]} · {dueLabel(i.due_date)}</div>
      </div>
      <MemberDot member={byId(i.member_id)} />
    </li>
  )

  return (
    <div className="page">
      <h1>Schule</h1>
      {children.length > 1 && <MemberPicker members={children} value={filter} onChange={setFilter} multiple />}
      <h2 className="section">Schularbeiten &amp; Tests</h2>
      {exams.length === 0 ? <Empty>Keine anstehenden Schularbeiten.</Empty> : <ul className="list">{exams.map(renderItem)}</ul>}
      <h2 className="section">Hausübungen</h2>
      {hues.length === 0 ? <Empty>Alle HÜs erledigt 🎉</Empty> : <ul className="list">{hues.map(renderItem)}</ul>}
      <label className="row muted"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Erledigte anzeigen</label>

      <Fab
        label="Neuer Eintrag"
        onClick={() => setEditing({ kind: 'hue', due_date: todayStr(), member_id: me?.role === 'child' ? me.id : (children[0]?.id ?? null) })}
      />
      {editing && familyId && (
        <SchoolForm
          initial={editing}
          members={children.length ? children : members}
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            if (editing.id) await updateRow('school_items', editing.id, v)
            else await insertRow('school_items', { done: false, ...v, family_id: familyId } as Omit<SchoolItem, 'id'>)
            setEditing(null)
          }}
          onDelete={editing.id ? async () => { await deleteRow('school_items', editing.id!); setEditing(null) } : undefined}
        />
      )}
    </div>
  )
}

const SUBJECTS = ['Deutsch', 'Mathematik', 'Englisch', 'Sachunterricht', 'Biologie', 'Geografie', 'Geschichte', 'Physik', 'Chemie', 'Latein', 'Französisch', 'Musik', 'Religion']

function SchoolForm({
  initial, members, onSave, onClose, onDelete,
}: {
  initial: Partial<SchoolItem>; members: Member[]
  onSave: (v: Partial<SchoolItem>) => Promise<void>; onClose: () => void; onDelete?: () => Promise<void>
}) {
  const [kind, setKind] = useState<SchoolKind>(initial.kind ?? 'hue')
  const [subject, setSubject] = useState(initial.subject ?? '')
  const [title, setTitle] = useState(initial.title ?? '')
  const [due, setDue] = useState(initial.due_date ?? todayStr())
  const [who, setWho] = useState<string[]>(initial.member_id ? [initial.member_id] : [])
  const [remindDays, setRemindDays] = useState<number | null>(initial.remind_days_before ?? (kind === 'hue' ? 1 : 3))

  return (
    <Sheet title={initial.id ? 'Eintrag bearbeiten' : 'Neue HÜ / Schularbeit'} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          void onSave({ kind, subject: subject.trim(), title: title || null, due_date: due, member_id: who[0] ?? null, remind_days_before: remindDays })
        }}
      >
        <div className="segmented">
          {(Object.keys(SCHOOL_KIND_LABEL) as SchoolKind[]).map((k) => (
            <button type="button" key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{SCHOOL_KIND_LABEL[k]}</button>
          ))}
        </div>
        <input list="subjects" placeholder="Fach" value={subject} onChange={(e) => setSubject(e.target.value)} required />
        <datalist id="subjects">{SUBJECTS.map((s) => <option key={s} value={s} />)}</datalist>
        <input placeholder={kind === 'hue' ? 'Was ist zu tun? (z. B. Buch S. 34, Nr. 1–5)' : 'Stoff (optional)'} value={title} onChange={(e) => setTitle(e.target.value)} />
        <span className="label">{kind === 'hue' ? 'Abgabe bis' : 'Datum'}</span>
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} required />
        <span className="label">Für wen?</span>
        <MemberPicker members={members} value={who} onChange={setWho} />
        <span className="label">Erinnerung</span>
        <select value={remindDays ?? ''} onChange={(e) => setRemindDays(e.target.value === '' ? null : Number(e.target.value))}>
          <option value="">Keine</option>
          <option value="0">Am selben Tag</option>
          <option value="1">1 Tag vorher</option>
          <option value="2">2 Tage vorher</option>
          <option value="3">3 Tage vorher</option>
          <option value="7">1 Woche vorher</option>
        </select>
        <div className="row end">
          {onDelete && <button type="button" className="btn danger" onClick={() => void onDelete()}>Löschen</button>}
          <button className="btn primary">Speichern</button>
        </div>
      </form>
    </Sheet>
  )
}
