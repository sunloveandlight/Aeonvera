create table if not exists public.wearable_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('oura', 'whoop')),
  access_token text not null,
  refresh_token text,
  token_type text default 'bearer',
  scope text,
  expires_at timestamptz,
  status text not null default 'connected',
  last_synced_at timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.wearable_connections enable row level security;

grant select, insert, update, delete on public.wearable_connections to authenticated;

create index if not exists wearable_connections_user_provider_idx
  on public.wearable_connections (user_id, provider);

drop policy if exists "Users can read own wearable connections"
  on public.wearable_connections;
create policy "Users can read own wearable connections"
  on public.wearable_connections
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own wearable connections"
  on public.wearable_connections;
create policy "Users can insert own wearable connections"
  on public.wearable_connections
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own wearable connections"
  on public.wearable_connections;
create policy "Users can update own wearable connections"
  on public.wearable_connections
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own wearable connections"
  on public.wearable_connections;
create policy "Users can delete own wearable connections"
  on public.wearable_connections
  for delete
  to authenticated
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
