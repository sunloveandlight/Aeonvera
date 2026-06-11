create table if not exists public.coach_memory_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  communication_style text not null default 'balanced' check (
    communication_style in ('encouraging', 'accountability', 'direct', 'balanced')
  ),
  motivation_profile jsonb not null default '{}'::jsonb,
  failure_patterns jsonb not null default '[]'::jsonb,
  best_interventions jsonb not null default '[]'::jsonb,
  domain_scores jsonb not null default '{}'::jsonb,
  morning_brief text,
  confidence numeric not null default 0.35,
  last_computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.coach_memory_profiles enable row level security;

grant select, insert, update on public.coach_memory_profiles to authenticated;

drop policy if exists "Users can read own coach memory profile"
  on public.coach_memory_profiles;
create policy "Users can read own coach memory profile"
  on public.coach_memory_profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own coach memory profile"
  on public.coach_memory_profiles;
create policy "Users can insert own coach memory profile"
  on public.coach_memory_profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own coach memory profile"
  on public.coach_memory_profiles;
create policy "Users can update own coach memory profile"
  on public.coach_memory_profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists coach_memory_profiles_computed_idx
  on public.coach_memory_profiles (last_computed_at desc);

notify pgrst, 'reload schema';
