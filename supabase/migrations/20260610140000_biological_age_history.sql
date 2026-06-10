create table if not exists public.biological_age_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assessment_id uuid,
  chronological_age numeric not null,
  biological_age numeric not null,
  age_delta numeric not null,
  score numeric,
  accuracy_score numeric,
  category text,
  source text not null default 'assessment' check (source in ('assessment', 'wearable', 'simulation', 'system')),
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.biological_age_history enable row level security;

grant select on public.biological_age_history to authenticated;

create index if not exists biological_age_history_user_created_idx
  on public.biological_age_history (user_id, created_at desc);

drop policy if exists "Users can read own biological age history"
  on public.biological_age_history;
create policy "Users can read own biological age history"
  on public.biological_age_history
  for select
  to authenticated
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
