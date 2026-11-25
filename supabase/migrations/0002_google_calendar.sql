-- Verknüpfung mit dem Google-Familienkalender (ein Kalender pro Familie)
create table google_links (
  family_id uuid primary key references families(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  refresh_token text not null,
  calendar_id text not null,
  calendar_name text,
  last_synced_at timestamptz
);
alter table google_links enable row level security;
-- Clients dürfen nur sehen, OB/welcher Kalender verknüpft ist; das Token liest nur der Server.
create policy "link insert" on google_links for insert with check (family_id in (select my_family_ids()));
create policy "link update" on google_links for update using (family_id in (select my_family_ids()));
create policy "link delete" on google_links for delete using (family_id in (select my_family_ids()));
create view google_link_status with (security_invoker = false) as
  select family_id, calendar_id, calendar_name, last_synced_at from google_links
  where family_id in (select my_family_ids());
grant select on google_link_status to authenticated;

-- Wird bei App-Änderungen gesetzt, damit der Sync weiß, was zu Google hochzuladen ist
alter table events add column updated_at timestamptz not null default now();
alter table events add column deleted boolean not null default false;
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin
  -- Änderungen durch den Sync selbst (Service-Role) nicht als App-Änderung zählen
  if auth.role() = 'service_role' then return new; end if;
  new.updated_at = now(); return new;
end $$;
create trigger events_touch before update on events for each row execute function touch_updated_at();

-- Zeitpläne (pg_cron + pg_net in Supabase aktivieren, dann <PROJECT> und <SERVICE_ROLE_KEY> ersetzen):
-- select cron.schedule('reminders', '*/5 * * * *', $$ select net.http_post('https://<PROJECT>.supabase.co/functions/v1/send-reminders', headers => '{"Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb) $$);
-- select cron.schedule('gcal-sync', '*/15 * * * *', $$ select net.http_post('https://<PROJECT>.supabase.co/functions/v1/google-calendar-sync', headers => '{"Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb) $$);
