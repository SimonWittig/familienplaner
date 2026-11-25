import { addDays, addMonths, addWeeks, format, parseISO } from 'date-fns'
import type { Recurrence } from './types'

export const toDateStr = (d: Date) => format(d, 'yyyy-MM-dd')
export const todayStr = () => toDateStr(new Date())

/** Nächstes Fälligkeitsdatum einer wiederkehrenden Aufgabe, immer in der Zukunft (ab morgen). */
export function nextDueDate(current: string | null | undefined, rec: Recurrence, now = new Date()): string {
  let d = current ? parseISO(current) : now
  const step = (x: Date) =>
    rec === 'daily' ? addDays(x, 1)
    : rec === 'weekly' ? addWeeks(x, 1)
    : rec === 'biweekly' ? addWeeks(x, 2)
    : addMonths(x, 1)
  d = step(d)
  const today = toDateStr(now)
  while (toDateStr(d) <= today) d = step(d)
  return toDateStr(d)
}
