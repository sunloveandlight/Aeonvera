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
