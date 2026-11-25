import webpush from 'npm:web-push@3'
import { createClient } from 'npm:@supabase/supabase-js@2'
// Verschickt fällige Erinnerungen als Web-Push. Läuft alle 5 Minuten per pg_cron.
// ---- gemeinsame Hilfsfunktionen (in jeder Funktion enthalten, damit sie im Supabase-Editor als eine Datei funktioniert) ----

export const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

/** Nur Aufrufe mit Service-Role-Key (Cron) oder angemeldete Nutzer:innen zulassen. */
export async function authorize(req: Request): Promise<{ ok: boolean; familyId?: string }> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return { ok: false }
  if (token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) return { ok: true }
  const { data } = await admin.auth.getUser(token)
  if (!data.user) return { ok: false }
  const { data: m } = await admin.from('members').select('family_id').eq('user_id', data.user.id).maybeSingle()
  return m ? { ok: true, familyId: m.family_id } : { ok: false }
}
// ---- Ende Hilfsfunktionen ----

const TZ = Deno.env.get('APP_TIMEZONE') ?? 'Europe/Vienna'
webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

const localDate = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: TZ }) // YYYY-MM-DD
const localHour = (d: Date) => Number(d.toLocaleString('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }))
const addDays = (s: string, n: number) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const KIND = { hue: 'Hausübung', schularbeit: 'Schularbeit', test: 'Test' } as Record<string, string>

interface Msg { memberIds: string[] | null; familyId: string; type: string; id: string; key: string; title: string; body: string; url: string }

Deno.serve(async (req) => {
  if (!(await authorize(req)).ok) return new Response('unauthorized', { status: 401 })
  const now = new Date()
  const today = localDate(now)
  const hour = localHour(now)
  const msgs: Msg[] = []

  // Termine: X Minuten vorher
  const { data: events } = await admin.from('events').select('*').eq('deleted', false).not('remind_minutes_before', 'is', null)
    .gte('starts_at', now.toISOString()).lte('starts_at', new Date(now.getTime() + 2 * 86400e3).toISOString())
  for (const e of events ?? []) {
    const at = new Date(new Date(e.starts_at).getTime() - e.remind_minutes_before * 60e3)
    if (now >= at) {
      const time = new Date(e.starts_at).toLocaleTimeString('de-AT', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
      msgs.push({ memberIds: e.member_ids?.length ? e.member_ids : null, familyId: e.family_id, type: 'event', id: e.id, key: e.starts_at,
        title: `📅 ${e.title}`, body: e.all_day ? 'Heute' : `um ${time}${e.location ? ' · ' + e.location : ''}`, url: '/termine' })
    }
  }

  // Schule: ab 15 Uhr, X Tage vorher bis zum Fälligkeitstag, einmal pro Tag
  if (hour >= 15) {
    const { data: school } = await admin.from('school_items').select('*').eq('done', false).not('remind_days_before', 'is', null)
      .gte('due_date', today).lte('due_date', addDays(today, 7))
    for (const s of school ?? []) {
      if (today >= addDays(s.due_date, -s.remind_days_before)) {
        const when = s.due_date === today ? 'heute' : s.due_date === addDays(today, 1) ? 'morgen' : `am ${s.due_date.split('-').reverse().join('.')}`
        msgs.push({ memberIds: s.member_id ? [s.member_id] : null, familyId: s.family_id, type: 'school', id: s.id, key: today,
          title: `📚 ${KIND[s.kind]} ${s.subject} ${when}`, body: s.title ?? 'Nicht vergessen!', url: '/schule' })
      }
    }
  }

  // ToDos: ab 7 Uhr am Fälligkeitstag
  if (hour >= 7) {
    const { data: todos } = await admin.from('todos').select('*').eq('done', false).eq('remind', true).eq('due_date', today)
    for (const t of todos ?? []) {
      msgs.push({ memberIds: t.assignee_id ? [t.assignee_id] : null, familyId: t.family_id, type: 'todo', id: t.id, key: today,
        title: `✅ ${t.title}`, body: 'Heute fällig', url: '/todos' })
    }
  }

  let sent = 0
  for (const m of msgs) {
    // nur einmal verschicken
    const { error: dup } = await admin.from('sent_reminders').insert({ item_type: m.type, item_id: m.id, remind_key: m.key })
    if (dup) continue
    let q = admin.from('push_subscriptions').select('*, members!inner(family_id)').eq('members.family_id', m.familyId)
    if (m.memberIds) q = q.in('member_id', m.memberIds)
    const { data: subs } = await q
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: m.title, body: m.body, url: m.url, tag: `${m.type}:${m.id}` }))
        sent++
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('id', s.id)
      }
    }
  }
  return Response.json({ checked: msgs.length, sent })
})
