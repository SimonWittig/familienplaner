import { useEffect } from 'react'
import { addMinutes, format, parseISO, subDays } from 'date-fns'
import { useFamily } from './family'
import { useTable } from './store'
import { localNotify } from './push'
import { toDateStr, todayStr } from './recurrence'
import { SCHOOL_KIND_LABEL } from './types'

/**
 * Prüft jede Minute, ob eine Erinnerung fällig ist, und zeigt sie lokal an,
 * solange die App offen ist. Push bei geschlossener App kommt vom Server (send-reminders).
 */
export function useLocalReminders() {
  const { familyId, me } = useFamily()
  const { rows: events } = useTable('events', familyId)
  const { rows: school } = useTable('school_items', familyId)
  const { rows: todos } = useTable('todos', familyId)

  useEffect(() => {
    const check = () => {
      const now = new Date()
      const today = todayStr()
      for (const e of events) {
        if (e.remind_minutes_before == null) continue
        if (me && e.member_ids.length && !e.member_ids.includes(me.id)) continue
        const at = addMinutes(parseISO(e.starts_at), -e.remind_minutes_before)
        if (now >= at && now < parseISO(e.starts_at)) {
          void localNotify(`ev:${e.id}:${e.starts_at}`, `📅 ${e.title}`, e.all_day ? 'Heute' : `um ${format(parseISO(e.starts_at), 'HH:mm')}`)
        }
      }
      for (const s of school) {
        if (s.done || s.remind_days_before == null) continue
        if (me?.role === 'child' && s.member_id && s.member_id !== me.id) continue
        const remindOn = toDateStr(subDays(parseISO(s.due_date), s.remind_days_before))
        if (today >= remindOn && today <= s.due_date && now.getHours() >= 15) {
          void localNotify(`sc:${s.id}:${today}`, `📚 ${SCHOOL_KIND_LABEL[s.kind]} ${s.subject}`, s.title ?? `fällig ${s.due_date === today ? 'heute' : 'am ' + s.due_date}`)
        }
      }
      for (const t of todos) {
        if (t.done || !t.remind || !t.due_date || t.due_date !== today) continue
        if (me && t.assignee_id && t.assignee_id !== me.id) continue
        if (now.getHours() >= 7) void localNotify(`td:${t.id}:${today}`, `✅ ${t.title}`, 'Heute fällig')
      }
    }
    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [events, school, todos, me])
}
