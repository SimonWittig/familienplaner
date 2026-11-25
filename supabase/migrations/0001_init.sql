-- Familienplaner: Grundschema
create extension if not exists "pgcrypto";

create table families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default substr(md5(random()::text), 1, 8),
  created_at timestamptz not null default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  color text not null default '#4f46e5',
  role text not null default 'parent' check (role in ('parent','child')),
  created_at timestamptz not null default now()
);
create index on members(family_id);
create index on members(user_id);

create table events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  location text,
  notes text,
  member_ids uuid[] not null default '{}',
  remind_minutes_before int,           -- null = keine Erinnerung
  external_source text,                -- 'google' | 'icloud' | 'outlook'
  external_id text,
  created_at timestamptz not null default now(),
  unique (family_id, external_source, external_id)
);
create index on events(family_id, starts_at);

create table school_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  kind text not null check (kind in ('hue','schularbeit','test')),
  subject text not null,
  title text,
  due_date date not null,
  done boolean not null default false,
  notes text,
  remind_days_before int default 1,
  created_at timestamptz not null default now()
);
create index on school_items(family_id, due_date);

create table todos (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  title text not null,
  assignee_id uuid references members(id) on delete set null,
  due_date date,
  recurrence text check (recurrence in ('daily','weekly','biweekly','monthly')),
  done boolean not null default false,
  last_done_at timestamptz,
  notes text,
  remind boolean not null default true,
  created_at timestamptz not null default now()
);
create index on todos(family_id, due_date);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- Merkt sich, welche Erinnerung schon verschickt wurde (nur Server-Zugriff)
create table sent_reminders (
  item_type text not null,
  item_id uuid not null,
  remind_key text not null,
  sent_at timestamptz not null default now(),
  primary key (item_type, item_id, remind_key)
);

-- ===== Row Level Security: jede Familie sieht nur ihre eigenen Daten =====
create or replace function my_family_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select family_id from members where user_id = auth.uid()
$$;

alter table families enable row level security;
alter table members enable row level security;
alter table events enable row level security;
alter table school_items enable row level security;
alter table todos enable row level security;
alter table push_subscriptions enable row level security;
alter table sent_reminders enable row level security;

create policy "family read" on families for select using (id in (select my_family_ids()));
create policy "family update" on families for update using (id in (select my_family_ids()));

create policy "members all" on members for all
  using (family_id in (select my_family_ids()))
  with check (family_id in (select my_family_ids()));

create policy "events all" on events for all
  using (family_id in (select my_family_ids()))
  with check (family_id in (select my_family_ids()));

create policy "school all" on school_items for all
  using (family_id in (select my_family_ids()))
  with check (family_id in (select my_family_ids()));

create policy "todos all" on todos for all
  using (family_id in (select my_family_ids()))
  with check (family_id in (select my_family_ids()));

create policy "push own" on push_subscriptions for all
  using (member_id in (select id from members where user_id = auth.uid()))
  with check (member_id in (select id from members where user_id = auth.uid()));

-- Familie anlegen und sich selbst als erstes Mitglied eintragen
create or replace function create_family(family_name text, my_name text, my_color text default '#4f46e5')
returns uuid language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  insert into families(name) values (family_name) returning id into fid;
  insert into members(family_id, user_id, name, color, role) values (fid, auth.uid(), my_name, my_color, 'parent');
  return fid;
end $$;

-- Mit Einladungscode einer Familie beitreten
create or replace function join_family(code text, my_name text, my_color text default '#16a34a')
returns uuid language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select id into fid from families where invite_code = code;
  if fid is null then raise exception 'Einladungscode ungültig'; end if;
  insert into members(family_id, user_id, name, color, role) values (fid, auth.uid(), my_name, my_color, 'parent');
  return fid;
end $$;
