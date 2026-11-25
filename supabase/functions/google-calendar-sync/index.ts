import { createClient } from 'npm:@supabase/supabase-js@2'
// Zwei-Wege-Sync zwischen dem Google-Familienkalender und der Tabelle "events".
// Läuft alle 15 Minuten per pg_cron und zusätzlich auf Knopfdruck aus der App.
// ---- gemeinsame Hilfsfunktionen (in jeder Funktion enthalten, damit sie im Supabase-Editor als eine Datei funktioniert) ----

export const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

/** Nur Aufrufe vom Zeitplan (x-cron-secret) oder von angemeldeten Familienmitgliedern zulassen. */
export async function authorize(req: Request): Promise<{ ok: boolean; familyId?: string }> {
  const cron = Deno.env.get('CRON_SECRET')
  if (cron && req.headers.get('x-cron-secret') === cron) return { ok: true }
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return { ok: false }
  const { data } = await admin.auth.getUser(token)
  if (!data.user) return { ok: false }
  const { data: m } = await admin.from('members').select('family_id').eq('user_id', data.user.id).maybeSingle()
  return m ? { ok: true, familyId: m.family_id } : { ok: false }
}
// ---- Ende Hilfsfunktionen ----

const API = 'https://www.googleapis.com/calendar/v3'

async function accessToken(refresh: string) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!, client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      refresh_token: refresh, grant_type: 'refresh_token',
    }),
  })
  if (!r.ok) throw new Error('Google-Token ungültig: ' + (await r.text()))
  return (await r.json()).access_token as string
}

interface GEvent { id: string; status: string; summary?: string; location?: string; description?: string
  start: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } }

function toGoogle(e: Record<string, unknown>) {
  const start = e.starts_at as string
  const end = (e.ends_at as string | null) ?? new Date(new Date(start).getTime() + 3600e3).toISOString()
  if (e.all_day) {
    const d = start.slice(0, 10)
    const next = new Date(d + 'T12:00:00Z'); next.setUTCDate(next.getUTCDate() + 1)
    return { summary: e.title, location: e.location, description: e.notes, start: { date: d }, end: { date: next.toISOString().slice(0, 10) } }
  }
  return { summary: e.title, location: e.location, description: e.notes, start: { dateTime: start }, end: { dateTime: end } }
}

async function syncFamily(link: { family_id: string; refresh_token: string; calendar_id: string; last_synced_at: string | null }) {
  const token = await accessToken(link.refresh_token)
  const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const cal = `${API}/calendars/${encodeURIComponent(link.calendar_id)}/events`
  const syncStart = new Date().toISOString()

  // 1) App → Google: neue, geänderte und gelöschte Termine
  const { data: local } = await admin.from('events').select('*').eq('family_id', link.family_id)
  for (const e of local ?? []) {
    const changed = !link.last_synced_at || e.updated_at > link.last_synced_at
    if (e.deleted) {
      if (e.external_id) await fetch(`${cal}/${e.external_id}`, { method: 'DELETE', headers: h })
      await admin.from('events').delete().eq('id', e.id)
    } else if (!e.external_id) {
      const r = await fetch(cal, { method: 'POST', headers: h, body: JSON.stringify(toGoogle(e)) })
      if (r.ok) await admin.from('events').update({ external_id: (await r.json()).id, external_source: 'google' }).eq('id', e.id)
    } else if (changed) {
      await fetch(`${cal}/${e.external_id}`, { method: 'PATCH', headers: h, body: JSON.stringify(toGoogle(e)) })
    }
  }

  // 2) Google → App: alles von 30 Tagen zurück bis 1 Jahr voraus
  const timeMin = new Date(Date.now() - 30 * 86400e3).toISOString()
  const timeMax = new Date(Date.now() + 365 * 86400e3).toISOString()
  let pageToken = ''
  do {
    const url = `${cal}?singleEvents=true&showDeleted=true&maxResults=250&timeMin=${timeMin}&timeMax=${timeMax}` +
      (link.last_synced_at ? `&updatedMin=${link.last_synced_at}` : '') + (pageToken ? `&pageToken=${pageToken}` : '')
    const r = await fetch(url, { headers: h })
    if (!r.ok) throw new Error('Google-Kalender: ' + (await r.text()))
    const page = await r.json() as { items: GEvent[]; nextPageToken?: string }
    for (const g of page.items) {
      if (g.status === 'cancelled') {
        await admin.from('events').delete().eq('family_id', link.family_id).eq('external_source', 'google').eq('external_id', g.id)
        continue
      }
      const allDay = !!g.start.date
      const row = {
        family_id: link.family_id, external_source: 'google', external_id: g.id,
        title: g.summary ?? '(ohne Titel)', location: g.location ?? null, notes: g.description ?? null, all_day: allDay,
        starts_at: allDay ? new Date(g.start.date + 'T00:00:00').toISOString() : g.start.dateTime!,
        ends_at: allDay ? null : (g.end?.dateTime ?? null),
        updated_at: '1970-01-01T00:00:00Z', // kommt von Google, nicht zurückspielen
      }
      const { data: existing } = await admin.from('events').select('id').eq('family_id', link.family_id)
        .eq('external_source', 'google').eq('external_id', g.id).maybeSingle()
      if (existing) await admin.from('events').update(row).eq('id', existing.id)
      else await admin.from('events').insert({ ...row, member_ids: [], remind_minutes_before: allDay ? null : 60 })
    }
    pageToken = page.nextPageToken ?? ''
  } while (pageToken)

  await admin.from('google_links').update({ last_synced_at: syncStart }).eq('family_id', link.family_id)
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const auth = await authorize(req)
  if (!auth.ok) return new Response('unauthorized', { status: 401, headers: CORS })
  let q = admin.from('google_links').select('*')
  if (auth.familyId) q = q.eq('family_id', auth.familyId)
  const { data: links } = await q
  const results: Record<string, string> = {}
  for (const l of links ?? []) {
    try { await syncFamily(l); results[l.family_id] = 'ok' } catch (e) { results[l.family_id] = (e as Error).message }
  }
  return Response.json(results, { headers: CORS })
})
