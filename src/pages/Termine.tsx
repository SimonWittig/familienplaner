import { useMemo, useState } from 'react'
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek,
} from 'date-fns'
import { de } from 'date-fns/locale'
import { useFamily } from '../lib/family'
import { deleteRow, insertRow, updateRow, useTable } from '../lib/store'
import { toDateStr } from '../lib/recurrence'
import type { FamilyEvent } from '../lib/types'
import { Empty, Fab, MemberDot, MemberPicker, Sheet } from '../components'

const REMINDERS: Array<[number | null, string]> = [
  [null, 'Keine'], [15, '15 Min. vorher'], [60, '1 Std. vorher'], [180, '3 Std. vorher'], [1440, '1 Tag vorher'],
]

export default function Termine() {
  const { familyId } = useFamily()
  const { rows: events } = useTable('events', familyId)
  const { rows: members } = useTable('members', familyId)
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState(() => new Date())
  const [editing, setEditing] = useState<Partial<FamilyEvent> | null>(null)

  const days = useMemo(
    () => eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) }),
    [month],
  )
  const sorted = useMemo(() => [...events].sort((a, b) => a.starts_at.localeCompare(b.starts_at)), [events])
  const onDay = (d: Date) => sorted.filter((e) => isSameDay(parseISO(e.starts_at), d))
  const byId = (id: string) => members.find((m) => m.id === id)

  return (
    <div className="page">
      <div className="month-head">
        <button className="icon-btn" onClick={() => setMonth(addMonths(month, -1))} aria-label="Voriger Monat">‹</button>
        <h1>{format(month, 'MMMM yyyy', { locale: de })}</h1>
        <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))} aria-label="Nächster Monat">›</button>
      </div>
      <div className="cal-grid">
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => <div key={d} className="cal-dow">{d}</div>)}
        {days.map((d) => {
          const evs = onDay(d)
          return (
            <button
              key={d.toISOString()}
              className={'cal-day' + (isSameMonth(d, month) ? '' : ' other') + (isSameDay(d, selected) ? ' sel' : '') + (isSameDay(d, new Date()) ? ' today' : '')}
              onClick={() => setSelected(d)}
            >
              <span>{format(d, 'd')}</span>
              <span className="dots">
                {evs.slice(0, 3).map((e) => (
                  <i key={e.id} style={{ background: byId(e.member_ids[0])?.color ?? 'var(--accent)' }} />
                ))}
              </span>
            </button>
          )
        })}
      </div>

      <h2 className="section">{format(selected, 'EEEE, d. MMMM', { locale: de })}</h2>
      {onDay(selected).length === 0 && <Empty>Keine Termine an diesem Tag.</Empty>}
      <ul className="list">
        {onDay(selected).map((e) => (
          <li key={e.id} className="card" onClick={() => setEditing(e)}>
            <div className="time">{e.all_day ? 'ganztägig' : format(parseISO(e.starts_at), 'HH:mm')}</div>
            <div className="grow">
              <div className="title">{e.title}</div>
              {e.location && <div className="sub">📍 {e.location}</div>}
            </div>
            <div className="dots-row">{e.member_ids.map((id) => <MemberDot key={id} member={byId(id)} />)}</div>
          </li>
        ))}
      </ul>

      <Fab label="Neuer Termin" onClick={() => setEditing({ starts_at: toDateStr(selected) + 'T09:00', member_ids: [], all_day: false })} />
      {editing && familyId && (
        <EventForm
          initial={editing}
          members={members}
          onClose={() => setEditing(null)}
          onSave={async (ev) => {
            if (editing.id) await updateRow('events', editing.id, ev)
            else await insertRow('events', { ...ev, family_id: familyId } as Omit<FamilyEvent, 'id'>)
            setEditing(null)
          }}
          onDelete={editing.id ? async () => { await deleteRow('events', editing.id!); setEditing(null) } : undefined}
        />
      )}
    </div>
  )
}

function EventForm({
  initial, members, onSave, onClose, onDelete,
}: {
  initial: Partial<FamilyEvent>
  members: import('../lib/types').Member[]
  onSave: (e: Partial<FamilyEvent>) => Promise<void>
  onClose: () => void
  onDelete?: () => Promise<void>
}) {
  const start = initial.starts_at ? parseISO(initial.starts_at) : new Date()
  const [title, setTitle] = useState(initial.title ?? '')
  const [date, setDate] = useState(toDateStr(start))
  const [time, setTime] = useState(format(start, 'HH:mm'))
  const [endTime, setEndTime] = useState(initial.ends_at ? format(parseISO(initial.ends_at), 'HH:mm') : '')
  const [allDay, setAllDay] = useState(initial.all_day ?? false)
  const [location, setLocation] = useState(initial.location ?? '')
  const [who, setWho] = useState<string[]>(initial.member_ids ?? [])
  const [remind, setRemind] = useState<number | null>(initial.remind_minutes_before ?? 60)

  return (
    <Sheet title={initial.id ? 'Termin bearbeiten' : 'Neuer Termin'} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          const startsAt = new Date(`${date}T${allDay ? '00:00' : time}`)
          const endsAt = !allDay && endTime ? new Date(`${date}T${endTime}`) : null
          void onSave({
            title: title.trim(), starts_at: startsAt.toISOString(), ends_at: endsAt?.toISOString() ?? null,
            all_day: allDay, location: location || null, member_ids: who, remind_minutes_before: remind,
          })
        }}
      >
        <input placeholder="Was?" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        <label className="row"><input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> Ganztägig</label>
        <div className="row">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          {!allDay && <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />}
          {!allDay && <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} aria-label="Ende" />}
        </div>
        <input placeholder="Ort (optional)" value={location} onChange={(e) => setLocation(e.target.value)} />
        <span className="label">Wer?</span>
        <MemberPicker members={members} value={who} onChange={setWho} multiple />
        <span className="label">Erinnerung</span>
        <select value={remind ?? ''} onChange={(e) => setRemind(e.target.value ? Number(e.target.value) : null)}>
          {REMINDERS.map(([v, l]) => <option key={l} value={v ?? ''}>{l}</option>)}
        </select>
        <div className="row end">
          {onDelete && <button type="button" className="btn danger" onClick={() => void onDelete()}>Löschen</button>}
          <button className="btn primary">Speichern</button>
        </div>
      </form>
    </Sheet>
  )
}
