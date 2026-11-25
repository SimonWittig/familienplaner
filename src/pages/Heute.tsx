import { format, isSameDay, parseISO, addDays } from 'date-fns'
import { de } from 'date-fns/locale'
import { useFamily } from '../lib/family'
import { useTable } from '../lib/store'
import { toDateStr, todayStr } from '../lib/recurrence'
import { SCHOOL_KIND_LABEL } from '../lib/types'
import { updateRow } from '../lib/store'
import { Empty, MemberDot } from '../components'
import { dueLabel } from './Schule'
import { toggleTodo } from './Todos'

export default function Heute() {
  const { familyId, me } = useFamily()
  const { rows: events } = useTable('events', familyId)
  const { rows: school } = useTable('school_items', familyId)
  const { rows: todos } = useTable('todos', familyId)
  const { rows: members } = useTable('members', familyId)
  const byId = (id?: string | null) => members.find((m) => m.id === id)

  const today = todayStr()
  const in7 = toDateStr(addDays(new Date(), 7))
  const todayEvents = events.filter((e) => isSameDay(parseISO(e.starts_at), new Date())).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  const tomorrowEvents = events.filter((e) => isSameDay(parseISO(e.starts_at), addDays(new Date(), 1)))
  const exams = school.filter((s) => !s.done && s.kind !== 'hue' && s.due_date >= today && s.due_date <= in7).sort((a, b) => a.due_date.localeCompare(b.due_date))
  const hues = school.filter((s) => !s.done && s.kind === 'hue' && s.due_date <= toDateStr(addDays(new Date(), 1))).sort((a, b) => a.due_date.localeCompare(b.due_date))
  const dueTodos = todos.filter((t) => !t.done && t.due_date && t.due_date <= today)

  return (
    <div className="page">
      <h1>Hallo{me ? ` ${me.name}` : ''} 👋</h1>
      <p className="muted">{format(new Date(), 'EEEE, d. MMMM yyyy', { locale: de })}</p>

      <h2 className="section">Termine heute</h2>
      {todayEvents.length === 0 ? <Empty>Heute keine Termine.</Empty> : (
        <ul className="list">
          {todayEvents.map((e) => (
            <li key={e.id} className="card">
              <div className="time">{e.all_day ? 'ganzt.' : format(parseISO(e.starts_at), 'HH:mm')}</div>
              <div className="grow"><div className="title">{e.title}</div>{e.location && <div className="sub">📍 {e.location}</div>}</div>
              <div className="dots-row">{e.member_ids.map((id) => <MemberDot key={id} member={byId(id)} />)}</div>
            </li>
          ))}
        </ul>
      )}
      {tomorrowEvents.length > 0 && <p className="muted">Morgen: {tomorrowEvents.map((e) => e.title).join(', ')}</p>}

      {exams.length > 0 && (
        <>
          <h2 className="section">Schularbeiten diese Woche</h2>
          <ul className="list">
            {exams.map((s) => (
              <li key={s.id} className="card exam">
                <div className="grow"><div className="title">{s.subject}</div><div className="sub">{SCHOOL_KIND_LABEL[s.kind]} · {dueLabel(s.due_date)}</div></div>
                <MemberDot member={byId(s.member_id)} />
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="section">Hausübungen</h2>
      {hues.length === 0 ? <Empty>Keine HÜs fällig.</Empty> : (
        <ul className="list">
          {hues.map((s) => (
            <li key={s.id} className="card">
              <input type="checkbox" className="check" checked={s.done} onChange={() => void updateRow('school_items', s.id, { done: true })} aria-label="Erledigt" />
              <div className="grow"><div className="title">{s.subject}{s.title ? `: ${s.title}` : ''}</div><div className="sub">{dueLabel(s.due_date)}</div></div>
              <MemberDot member={byId(s.member_id)} />
            </li>
          ))}
        </ul>
      )}

      <h2 className="section">ToDos für heute</h2>
      {dueTodos.length === 0 ? <Empty>Alles erledigt.</Empty> : (
        <ul className="list">
          {dueTodos.map((t) => (
            <li key={t.id} className="card">
              <input type="checkbox" className="check" checked={false} onChange={() => void toggleTodo(t)} aria-label="Erledigt" />
              <div className="grow"><div className="title">{t.title}</div><div className="sub">{dueLabel(t.due_date!)}</div></div>
              <MemberDot member={byId(t.assignee_id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
