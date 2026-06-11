create table if not exists public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'google' check (provider in ('google')),
  access_token text not null,
  refresh_token text,
  token_type text default 'bearer',
  scope text,
  expires_at timestamptz,
  status text not null default 'connected' check (status in ('connected', 'expired', 'revoked')),
  calendar_id text not null default 'primary',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid references public.calendar_connections(id) on delete set null,
  protocol_id uuid references public.optimization_protocols(id) on delete set null,
  provider text not null default 'google' check (provider in ('google')),
  provider_event_id text,
  calendar_id text not null default 'primary',
  title text not null,
  description text,
  action text,
  action_scope text check (action_scope in ('today', 'week', 'check_in', 'later')),
  scheduled_for timestamptz not null,
  duration_minutes integer not null default 30,
  recurrence text check (recurrence in ('none', 'daily', 'weekly')),
  html_link text,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendar_connections enable row level security;
alter table public.calendar_events enable row level security;

grant select, insert, update, delete on public.calendar_connections to authenticated;
grant select, insert, update, delete on public.calendar_events to authenticated;

create index if not exists calendar_connections_user_provider_idx
  on public.calendar_connections (user_id, provider);

create index if not exists calendar_events_user_scheduled_idx
  on public.calendar_events (user_id, scheduled_for desc);

create index if not exists calendar_events_protocol_idx
  on public.calendar_events (protocol_id, scheduled_for desc);

drop policy if exists "Users can manage own calendar connections"
  on public.calendar_connections;
create policy "Users can manage own calendar connections"
  on public.calendar_connections
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage own calendar events"
  on public.calendar_events;
create policy "Users can manage own calendar events"
  on public.calendar_events
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
