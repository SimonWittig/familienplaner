export type Role = 'parent' | 'child'

export interface Member {
  id: string
  family_id: string
  user_id?: string | null
  name: string
  color: string
  role: Role
}

export interface FamilyEvent {
  id: string
  family_id: string
  title: string
  starts_at: string // ISO
  ends_at?: string | null
  all_day: boolean
  location?: string | null
  notes?: string | null
  member_ids: string[]
  remind_minutes_before?: number | null
  external_source?: string | null
}

export type SchoolKind = 'hue' | 'schularbeit' | 'test'

export interface SchoolItem {
  id: string
  family_id: string
  member_id?: string | null
  kind: SchoolKind
  subject: string
  title?: string | null
  due_date: string // YYYY-MM-DD
  done: boolean
  notes?: string | null
  remind_days_before?: number | null
}

export type Recurrence = 'daily' | 'weekly' | 'biweekly' | 'monthly'

export interface Todo {
  id: string
  family_id: string
  title: string
  assignee_id?: string | null
  due_date?: string | null // YYYY-MM-DD
  recurrence?: Recurrence | null
  done: boolean
  last_done_at?: string | null
  notes?: string | null
  remind: boolean
}

export interface Tables {
  members: Member
  events: FamilyEvent
  school_items: SchoolItem
  todos: Todo
}
export type TableName = keyof Tables

export const SCHOOL_KIND_LABEL: Record<SchoolKind, string> = {
  hue: 'Hausübung',
  schularbeit: 'Schularbeit',
  test: 'Test',
}

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  daily: 'täglich',
  weekly: 'wöchentlich',
  biweekly: 'alle 2 Wochen',
  monthly: 'monatlich',
}
