create table if not exists public.care_network_memberships (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  invite_token uuid not null default gen_random_uuid(),
  member_email text not null,
  member_name text,
  role text not null check (role in ('physician', 'coach', 'family')),
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked', 'expired')),
  permissions text[] not null default array[
    'snapshot',
    'biological_age',
    'labs',
    'protocols',
    'outcomes'
  ],
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  access_count integer not null default 0,
  last_accessed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.care_network_memberships enable row level security;

grant select, insert, update, delete on public.care_network_memberships to authenticated;

create unique index if not exists care_network_memberships_invite_token_idx
  on public.care_network_memberships (invite_token);

create index if not exists care_network_memberships_owner_created_idx
  on public.care_network_memberships (owner_user_id, created_at desc);

create index if not exists care_network_memberships_owner_role_idx
  on public.care_network_memberships (owner_user_id, role, status);

create index if not exists care_network_memberships_active_invite_idx
  on public.care_network_memberships (invite_token, expires_at)
  where revoked_at is null;

drop policy if exists "Users can read own care network memberships"
  on public.care_network_memberships;
create policy "Users can read own care network memberships"
  on public.care_network_memberships
  for select
  to authenticated
  using (auth.uid() = owner_user_id);

drop policy if exists "Users can insert own care network memberships"
  on public.care_network_memberships;
create policy "Users can insert own care network memberships"
  on public.care_network_memberships
  for insert
  to authenticated
  with check (auth.uid() = owner_user_id);

drop policy if exists "Users can update own care network memberships"
  on public.care_network_memberships;
create policy "Users can update own care network memberships"
  on public.care_network_memberships
  for update
  to authenticated
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

drop policy if exists "Users can delete own care network memberships"
  on public.care_network_memberships;
create policy "Users can delete own care network memberships"
  on public.care_network_memberships
  for delete
  to authenticated
  using (auth.uid() = owner_user_id);

notify pgrst, 'reload schema';
