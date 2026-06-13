create table if not exists public.life_os_priorities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null check (
    domain in (
      'health',
      'performance',
      'cognition',
      'sleep',
      'learning',
      'productivity',
      'emotional_resilience',
      'stress',
      'relationships',
      'purpose',
      'financial_health'
    )
  ),
  title text not null,
  desired_outcome text,
  next_action text,
  priority integer not null default 3 check (priority >= 1 and priority <= 5),
  horizon_days integer not null default 90 check (horizon_days >= 7 and horizon_days <= 365),
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'archived')),
  source text not null default 'life_os' check (source in ('life_os', 'agent', 'user', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.life_os_priorities enable row level security;

grant select, insert, update, delete on public.life_os_priorities to authenticated;

create index if not exists life_os_priorities_user_status_idx
  on public.life_os_priorities (user_id, status, priority desc, updated_at desc);

create index if not exists life_os_priorities_user_domain_idx
  on public.life_os_priorities (user_id, domain, status);

drop policy if exists "Users can read own life os priorities"
  on public.life_os_priorities;
create policy "Users can read own life os priorities"
  on public.life_os_priorities
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own life os priorities"
  on public.life_os_priorities;
create policy "Users can insert own life os priorities"
  on public.life_os_priorities
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own life os priorities"
  on public.life_os_priorities;
create policy "Users can update own life os priorities"
  on public.life_os_priorities
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own life os priorities"
  on public.life_os_priorities;
create policy "Users can delete own life os priorities"
  on public.life_os_priorities
  for delete
  to authenticated
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
