import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { TableName, Tables } from './types'

/**
 * Einheitlicher Datenzugriff. Mit Supabase-Konfiguration geht alles an den Server,
 * ohne Konfiguration (Demo-Modus) in den localStorage des Browsers.
 */
const LS_PREFIX = 'familienplaner:'
const listeners = new Set<() => void>()
let channelSeq = 0
const notify = () => listeners.forEach((l) => l())

function lsRead<T>(table: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(LS_PREFIX + table) ?? '[]') as T[]
  } catch {
    return []
  }
}
function lsWrite<T>(table: string, rows: T[]) {
  localStorage.setItem(LS_PREFIX + table, JSON.stringify(rows))
}

export async function listRows<K extends TableName>(table: K, familyId: string): Promise<Tables[K][]> {
  if (!supabase) return lsRead<Tables[K]>(table).filter((r) => r.family_id === familyId)
  let q = supabase.from(table).select('*').eq('family_id', familyId)
  if (table === 'events') q = q.eq('deleted', false)
  const { data, error } = await q
  if (error) throw error
  return data as Tables[K][]
}

export async function insertRow<K extends TableName>(table: K, row: Omit<Tables[K], 'id'>): Promise<Tables[K]> {
  let created: Tables[K]
  if (!supabase) {
    created = { ...row, id: crypto.randomUUID() } as Tables[K]
    lsWrite(table, [...lsRead<Tables[K]>(table), created])
  } else {
    const { data, error } = await supabase.from(table).insert(row as never).select().single()
    if (error) throw error
    created = data as Tables[K]
  }
  notify()
  return created
}

export async function updateRow<K extends TableName>(table: K, id: string, patch: Partial<Tables[K]>) {
  if (!supabase) {
    lsWrite(table, lsRead<Tables[K]>(table).map((r) => (r.id === id ? { ...r, ...patch } : r)))
  } else {
    const { error } = await supabase.from(table).update(patch as never).eq('id', id)
    if (error) throw error
  }
  notify()
}

export async function deleteRow(table: TableName, id: string) {
  if (!supabase) {
    lsWrite(table, lsRead<{ id: string }>(table).filter((r) => r.id !== id))
  } else if (table === 'events') {
    // Termine nur markieren, damit der Google-Sync sie auch dort löschen kann
    const { error } = await supabase.from(table).update({ deleted: true } as never).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) throw error
  }
  notify()
}

/** React-Hook: lädt eine Tabelle und aktualisiert sich bei Änderungen (auch von anderen Geräten via Realtime). */
export function useTable<K extends TableName>(table: K, familyId: string | null) {
  const [rows, setRows] = useState<Tables[K][]>([])
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!familyId) return
    try {
      setRows(await listRows(table, familyId))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [table, familyId])

  useEffect(() => {
    void reload()
    listeners.add(reload)
    let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null
    if (supabase && familyId) {
      channel = supabase
        .channel(`${table}:${familyId}:${++channelSeq}`)
        .on('postgres_changes', { event: '*', schema: 'public', table, filter: `family_id=eq.${familyId}` }, () => void reload())
        .subscribe()
    }
    return () => {
      listeners.delete(reload)
      if (channel) void supabase?.removeChannel(channel)
    }
  }, [reload, table, familyId])

  return { rows, error, reload }
}
