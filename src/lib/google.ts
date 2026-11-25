import { supabase } from './supabase'

/**
 * Google gibt das Refresh-Token nur direkt nach dem Login heraus.
 * Wir merken es uns kurz lokal, bis der Familienkalender ausgewählt ist.
 */
const K_ACCESS = 'familienplaner:gAccess'
const K_REFRESH = 'familienplaner:gRefresh'

export function captureGoogleTokens() {
  supabase?.auth.onAuthStateChange((_ev, session) => {
    if (session?.provider_token) localStorage.setItem(K_ACCESS, session.provider_token)
    if (session?.provider_refresh_token) localStorage.setItem(K_REFRESH, session.provider_refresh_token)
  })
}

export interface GCalendar { id: string; summary: string; primary?: boolean; accessRole: string }

export async function listCalendars(): Promise<GCalendar[] | null> {
  const token = localStorage.getItem(K_ACCESS)
  if (!token) return null
  const r = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) return null // Token abgelaufen → neu anmelden
  return ((await r.json()).items as GCalendar[])
}

export async function linkCalendar(familyId: string, memberId: string, cal: GCalendar) {
  const refresh = localStorage.getItem(K_REFRESH)
  if (!refresh) throw new Error('Bitte einmal neu mit Google anmelden, damit die App dauerhaft auf den Kalender zugreifen darf.')
  const { error } = await supabase!.from('google_links').upsert({
    family_id: familyId, member_id: memberId, refresh_token: refresh, calendar_id: cal.id, calendar_name: cal.summary, last_synced_at: null,
  })
  if (error) throw error
  localStorage.removeItem(K_REFRESH)
  await syncNow()
}

export async function syncNow() {
  const { data, error } = await supabase!.functions.invoke('google-calendar-sync')
  if (error) throw error
  return data
}

export async function linkStatus(): Promise<{ calendar_name: string; last_synced_at: string | null } | null> {
  const { data } = await supabase!.from('google_link_status').select('calendar_name, last_synced_at').maybeSingle()
  return data
}

export function reauthGoogle() {
  void supabase!.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/familie',
      scopes: 'openid email profile https://www.googleapis.com/auth/calendar',
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  })
}
