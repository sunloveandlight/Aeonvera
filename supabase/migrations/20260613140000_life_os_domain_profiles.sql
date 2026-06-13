create table if not exists public.life_os_domain_profiles (
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
  score numeric not null default 50 check (score >= 0 and score <= 100),
  direction text not null default 'learning' check (direction in ('improving', 'stable', 'declining', 'learning')),
  current_state text,
  desired_state text,
  key_risk text,
  next_action text,
  confidence numeric not null default 0.5 check (confidence >= 0 and confidence <= 1),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, domain)
);

alter table public.life_os_domain_profiles enable row level security;

grant select, insert, update, delete on public.life_os_domain_profiles to authenticated;

create index if not exists life_os_domain_profiles_user_domain_idx
  on public.life_os_domain_profiles (user_id, domain);

create index if not exists life_os_domain_profiles_user_score_idx
  on public.life_os_domain_profiles (user_id, score desc);

drop policy if exists "Users can read own life os domains"
  on public.life_os_domain_profiles;
create policy "Users can read own life os domains"
  on public.life_os_domain_profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own life os domains"
  on public.life_os_domain_profiles;
create policy "Users can insert own life os domains"
  on public.life_os_domain_profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own life os domains"
  on public.life_os_domain_profiles;
create policy "Users can update own life os domains"
  on public.life_os_domain_profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own life os domains"
  on public.life_os_domain_profiles;
create policy "Users can delete own life os domains"
  on public.life_os_domain_profiles
  for delete
  to authenticated
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
