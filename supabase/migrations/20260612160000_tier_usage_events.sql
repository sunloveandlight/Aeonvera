create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meter text not null check (
    meter in (
      'agent_question',
      'voice_question',
      'report_generation',
      'optimization_protocol',
      'future_self_simulation',
      'lab_import'
    )
  ),
  plan text check (plan in ('core', 'elite', 'sovereign')),
  units integer not null default 1 check (units > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.usage_events enable row level security;

grant select, insert on public.usage_events to authenticated;

create index if not exists usage_events_user_meter_created_idx
  on public.usage_events (user_id, meter, created_at desc);

drop policy if exists "Users can read own usage events"
  on public.usage_events;
create policy "Users can read own usage events"
  on public.usage_events
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own usage events"
  on public.usage_events;
create policy "Users can insert own usage events"
  on public.usage_events
  for insert
  to authenticated
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
