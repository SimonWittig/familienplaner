import { useMemo, useState } from 'react'
import { useFamily } from '../lib/family'
import { deleteRow, insertRow, updateRow, useTable } from '../lib/store'
import { nextDueDate, todayStr } from '../lib/recurrence'
import { RECURRENCE_LABEL, type Member, type Recurrence, type Todo } from '../lib/types'
import { Empty, Fab, MemberDot, MemberPicker, Sheet } from '../components'
import { dueLabel } from './Schule'

/** Abhaken: einmalige ToDos werden erledigt, wiederkehrende springen auf das nächste Datum. */
export async function toggleTodo(t: Todo) {
  if (t.recurrence && !t.done) {
    await updateRow('todos', t.id, { due_date: nextDueDate(t.due_date, t.recurrence), last_done_at: new Date().toISOString() })
  } else {
    await updateRow('todos', t.id, { done: !t.done, last_done_at: t.done ? null : new Date().toISOString() })
  }
}

export default function Todos() {
  const { familyId, me } = useFamily()
  const { rows: todos } = useTable('todos', familyId)
  const { rows: members } = useTable('members', familyId)
  const [filter, setFilter] = useState<string[]>([])
  const [editing, setEditing] = useState<Partial<Todo> | null>(null)
  const [quick, setQuick] = useState('')

  const open = useMemo(
    () => todos
      .filter((t) => !t.done)
      .filter((t) => filter.length === 0 || (t.assignee_id && filter.includes(t.assignee_id)))
      .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')),
    [todos, filter],
  )
  const done = todos.filter((t) => t.done).slice(-10)
  const byId = (id?: string | null) => members.find((m) => m.id === id)

  const item = (t: Todo) => (
    <li key={t.id} className={'card' + (t.done ? ' done' : '')}>
      <input type="checkbox" className="check" checked={t.done} onChange={() => void toggleTodo(t)} aria-label="Erledigt" />
      <div className="grow" onClick={() => setEditing(t)}>
        <div className="title">{t.title}</div>
        <div className="sub">
          {t.due_date && <span className={t.due_date < todayStr() && !t.done ? 'overdue' : ''}>{dueLabel(t.due_date)}</span>}
          {t.recurrence && <span> · 🔁 {RECURRENCE_LABEL[t.recurrence]}</span>}
        </div>
      </div>
      <MemberDot member={byId(t.assignee_id)} />
    </li>
  )

  return (
    <div className="page">
      <h1>ToDos</h1>
      <form
        className="quick-add"
        onSubmit={(e) => {
          e.preventDefault()
          if (!quick.trim() || !familyId) return
          void insertRow('todos', { family_id: familyId, title: quick.trim(), done: false, remind: true, assignee_id: me?.id ?? null, due_date: null, recurrence: null })
          setQuick('')
        }}
      >
        <input placeholder="Schnell hinzufügen…" value={quick} onChange={(e) => setQuick(e.target.value)} />
        <button className="btn primary">+</button>
      </form>
      <MemberPicker members={members} value={filter} onChange={setFilter} multiple />
      {open.length === 0 ? <Empty>Nichts zu tun. 👍</Empty> : <ul className="list">{open.map(item)}</ul>}
      {done.length > 0 && (
        <>
          <h2 className="section">Zuletzt erledigt</h2>
          <ul className="list">{done.map(item)}</ul>
        </>
      )}
      <Fab label="Neues ToDo" onClick={() => setEditing({ assignee_id: me?.id ?? null, remind: true })} />
      {editing && familyId && (
        <TodoForm
          initial={editing}
          members={members}
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            if (editing.id) await updateRow('todos', editing.id, v)
            else await insertRow('todos', { done: false, ...v, family_id: familyId } as Omit<Todo, 'id'>)
            setEditing(null)
          }}
          onDelete={editing.id ? async () => { await deleteRow('todos', editing.id!); setEditing(null) } : undefined}
        />
      )}
    </div>
  )
}

function TodoForm({
  initial, members, onSave, onClose, onDelete,
}: {
  initial: Partial<Todo>; members: Member[]
  onSave: (v: Partial<Todo>) => Promise<void>; onClose: () => void; onDelete?: () => Promise<void>
}) {
  const [title, setTitle] = useState(initial.title ?? '')
  const [due, setDue] = useState(initial.due_date ?? '')
  const [rec, setRec] = useState<Recurrence | ''>(initial.recurrence ?? '')
  const [who, setWho] = useState<string[]>(initial.assignee_id ? [initial.assignee_id] : [])
  const [remind, setRemind] = useState(initial.remind ?? true)

  return (
    <Sheet title={initial.id ? 'ToDo bearbeiten' : 'Neues ToDo'} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          void onSave({
            title: title.trim(), due_date: due || (rec ? todayStr() : null), recurrence: rec || null,
            assignee_id: who[0] ?? null, remind, done: false,
          })
        }}
      >
        <input placeholder="Was ist zu tun?" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        <span className="label">Fällig am</span>
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <span className="label">Wiederholen</span>
        <select value={rec} onChange={(e) => setRec(e.target.value as Recurrence | '')}>
          <option value="">Einmalig</option>
          {(Object.keys(RECURRENCE_LABEL) as Recurrence[]).map((r) => <option key={r} value={r}>{RECURRENCE_LABEL[r]}</option>)}
        </select>
        <span className="label">Wer?</span>
        <MemberPicker members={members} value={who} onChange={setWho} />
        <label className="row"><input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} /> Am Fälligkeitstag erinnern</label>
        <div className="row end">
          {onDelete && <button type="button" className="btn danger" onClick={() => void onDelete()}>Löschen</button>}
          <button className="btn primary">Speichern</button>
        </div>
      </form>
    </Sheet>
  )
}
