import { createClient } from 'npm:@supabase/supabase-js@2'

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
