-- Nido: pegá todo esto en Supabase › SQL Editor › New query y tocá "Run". Se corre una sola vez.
create extension if not exists pgcrypto;

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Nido',
  invite_code text unique not null default encode(gen_random_bytes(6), 'hex'),
  cal_token text unique not null default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now()
);

create table if not exists members (
  household_id uuid not null references households on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- Todo lo de la app (tareas, súper, hábitos, avisos…) vive acá como documentos JSON.
create table if not exists docs (
  household_id uuid not null references households on delete cascade,
  col text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (household_id, col, id)
);

create table if not exists push_subs (
  endpoint text primary key,
  household_id uuid not null references households on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  profile_key text,
  sub jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists push_log (key text primary key, sent_at timestamptz not null default now());

alter table households enable row level security;
alter table members enable row level security;
alter table docs enable row level security;
alter table push_subs enable row level security;
alter table push_log enable row level security;

create or replace function is_member(h uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from members where household_id = h and user_id = auth.uid())
$$;

drop policy if exists "ver mi nido" on households;
create policy "ver mi nido" on households for select using (is_member(id));
drop policy if exists "ver miembros" on members;
create policy "ver miembros" on members for select using (is_member(household_id));
drop policy if exists "docs del nido" on docs;
create policy "docs del nido" on docs for all using (is_member(household_id)) with check (is_member(household_id));
drop policy if exists "mis dispositivos" on push_subs;
create policy "mis dispositivos" on push_subs for all using (user_id = auth.uid()) with check (user_id = auth.uid() and is_member(household_id));

create or replace function create_household() returns uuid
language plpgsql security definer set search_path = public as $$
declare h uuid;
begin
  select household_id into h from members where user_id = auth.uid() limit 1;
  if h is not null then return h; end if;
  insert into households default values returning id into h;
  insert into members (household_id, user_id) values (h, auth.uid());
  return h;
end $$;

create or replace function join_household(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare h uuid; n int;
begin
  select id into h from households where invite_code = lower(trim(code));
  if h is null then raise exception 'Código inválido'; end if;
  select count(*) into n from members where household_id = h;
  if n >= 2 and not exists (select 1 from members where household_id = h and user_id = auth.uid()) then
    raise exception 'Este nido ya tiene a sus dos personas';
  end if;
  insert into members (household_id, user_id) values (h, auth.uid()) on conflict do nothing;
  return h;
end $$;

grant execute on function create_household() to authenticated;
grant execute on function join_household(text) to authenticated;

-- Sincronización en vivo entre los dos celulares
alter table docs replica identity full;
do $$ begin
  alter publication supabase_realtime add table docs;
exception when duplicate_object then null; end $$;
