-- Neue Supabase-Projekte vergeben keine Standardrechte mehr: Rechte explizit setzen.
-- Der Zugriff bleibt per Row Level Security auf die eigene Familie beschränkt.
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on families, members, events, school_items, todos, push_subscriptions, google_links to authenticated;
grant select on google_link_status to authenticated;
grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public grant all on tables to service_role;

-- Familie anlegen/beitreten nur einmal pro Person (Doppelklick legte sonst mehrere Familien an)
create or replace function create_family(family_name text, my_name text, my_color text default '#4f46e5')
returns uuid language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select family_id into fid from members where user_id = auth.uid() limit 1;
  if fid is not null then return fid; end if;
  insert into families(name) values (family_name) returning id into fid;
  insert into members(family_id, user_id, name, color, role) values (fid, auth.uid(), my_name, my_color, 'parent');
  return fid;
end $$;

create or replace function join_family(code text, my_name text, my_color text default '#16a34a')
returns uuid language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select family_id into fid from members where user_id = auth.uid() limit 1;
  if fid is not null then return fid; end if;
  select id into fid from families where invite_code = lower(trim(code));
  if fid is null then raise exception 'Einladungscode ungültig'; end if;
  insert into members(family_id, user_id, name, color, role) values (fid, auth.uid(), my_name, my_color, 'parent');
  return fid;
end $$;
