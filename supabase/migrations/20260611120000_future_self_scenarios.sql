create table if not exists public.future_self_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Future self scenario',
  description text,
  scenario_ids text[] not null default '{}',
  controls jsonb not null default '{}'::jsonb,
  projection jsonb not null default '{}'::jsonb,
  future_self jsonb not null default '{}'::jsonb,
  share_token uuid not null default gen_random_uuid(),
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.future_self_scenarios enable row level security;

grant select, insert, update, delete on public.future_self_scenarios to authenticated;
grant select on public.future_self_scenarios to anon;

create unique index if not exists future_self_scenarios_share_token_idx
  on public.future_self_scenarios (share_token);

create index if not exists future_self_scenarios_user_created_idx
  on public.future_self_scenarios (user_id, created_at desc);

create index if not exists future_self_scenarios_public_created_idx
  on public.future_self_scenarios (created_at desc)
  where is_public = true;

drop policy if exists "Users can read own future self scenarios"
  on public.future_self_scenarios;
create policy "Users can read own future self scenarios"
  on public.future_self_scenarios
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can read public future self scenarios"
  on public.future_self_scenarios;
create policy "Users can read public future self scenarios"
  on public.future_self_scenarios
  for select
  to anon, authenticated
  using (is_public = true);

drop policy if exists "Users can insert own future self scenarios"
  on public.future_self_scenarios;
create policy "Users can insert own future self scenarios"
  on public.future_self_scenarios
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own future self scenarios"
  on public.future_self_scenarios;
create policy "Users can update own future self scenarios"
  on public.future_self_scenarios
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own future self scenarios"
  on public.future_self_scenarios;
create policy "Users can delete own future self scenarios"
  on public.future_self_scenarios
  for delete
  to authenticated
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
