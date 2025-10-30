create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('owner','coach','scorer','viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.profiles (
  id uuid primary key,
  email text,
  name text,
  created_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  handedness text check (handedness in ('R','L')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  player_a_id uuid not null references public.players(id) on delete restrict,
  player_b_id uuid not null references public.players(id) on delete restrict,
  event text,
  surface text check (surface in ('Hard','Clay','Grass','Carpet')),
  format text check (format in ('BO3','BO5')) default 'BO3',
  start_time timestamptz default now(),
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.points (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid not null references public.matches(id) on delete cascade,
  seq int not null,
  server text not null check (server in ('A','B')),
  first_serve_in boolean,
  second_serve_in boolean,
  rally_len int default 0,
  finishing_shot text check (finishing_shot in ('FH','BH','Serve','Return','Volley','Overhead')),
  outcome text not null check (outcome in ('A','B')),
  finish_type text not null check (finish_type in ('Winner','UE','Forced','Ace','DF')),
  tags text[] default '{}',
  created_by uuid,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (match_id, seq)
);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.points enable row level security;
alter table public.profiles enable row level security;

create or replace function public.is_member_of(ws uuid)
returns boolean language sql stable as $$
  select exists ( select 1 from public.workspace_members m where m.workspace_id = ws and m.user_id = auth.uid() );
$$;

create policy "profiles self read" on public.profiles for select using ( id = auth.uid() );
create policy "profiles self upsert" on public.profiles for insert with check ( id = auth.uid() );
create policy "profiles self update" on public.profiles for update using ( id = auth.uid() );

create policy "workspace members can read" on public.workspaces for select using ( public.is_member_of(id) );

create policy "members read members" on public.workspace_members for select using ( public.is_member_of(workspace_id) );
create policy "owner manage members" on public.workspace_members for insert with check (
  exists (select 1 from public.workspace_members m where m.workspace_id = workspace_id and m.user_id = auth.uid() and m.role = 'owner')
);
create policy "owner update members" on public.workspace_members for update using (
  exists (select 1 from public.workspace_members m where m.workspace_id = workspace_id and m.user_id = auth.uid() and m.role = 'owner')
);
create policy "owner delete members" on public.workspace_members for delete using (
  exists (select 1 from public.workspace_members m where m.workspace_id = workspace_id and m.user_id = auth.uid() and m.role = 'owner')
);

create policy "members read players" on public.players for select using ( public.is_member_of(workspace_id) );
create policy "coach+ insert players" on public.players for insert with check (
  public.is_member_of(workspace_id) and exists (select 1 from public.workspace_members m where m.workspace_id = workspace_id and m.user_id = auth.uid() and m.role in ('owner','coach'))
);
create policy "coach+ update players" on public.players for update using (
  public.is_member_of(workspace_id) and exists (select 1 from public.workspace_members m where m.workspace_id = workspace_id and m.user_id = auth.uid() and m.role in ('owner','coach'))
);

create policy "members read matches" on public.matches for select using ( public.is_member_of(workspace_id) );
create policy "coach+ insert matches" on public.matches for insert with check (
  public.is_member_of(workspace_id) and exists (select 1 from public.workspace_members m where m.workspace_id = workspace_id and m.user_id = auth.uid() and m.role in ('owner','coach'))
);
create policy "coach+ update matches" on public.matches for update using (
  public.is_member_of(workspace_id) and exists (select 1 from public.workspace_members m where m.workspace_id = workspace_id and m.user_id = auth.uid() and m.role in ('owner','coach'))
);

create policy "members read points" on public.points for select using (
  exists (select 1 from public.matches mt where mt.id = match_id and public.is_member_of(mt.workspace_id))
);
create policy "scorer insert points" on public.points for insert with check (
  exists (select 1 from public.matches mt join public.workspace_members m on m.workspace_id = mt.workspace_id where mt.id = match_id and m.user_id = auth.uid() and m.role in ('owner','coach','scorer'))
);
create policy "scorer soft-delete points" on public.points for update using (
  exists (select 1 from public.matches mt join public.workspace_members m on m.workspace_id = mt.workspace_id where mt.id = match_id and m.user_id = auth.uid() and m.role in ('owner','coach','scorer'))
);

revoke all on schema public from public;
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update on all tables in schema public to authenticated;
