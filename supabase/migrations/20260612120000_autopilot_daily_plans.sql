create table if not exists public.autopilot_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  mode text not null default 'approve' check (mode in ('manual', 'suggest', 'approve', 'autopilot', 'sovereign')),
  calendar_enabled boolean not null default true,
  notifications_enabled boolean not null default true,
  auto_schedule_enabled boolean not null default false,
  allow_training_blocks boolean not null default true,
  allow_nutrition_blocks boolean not null default true,
  allow_recovery_blocks boolean not null default true,
  allow_check_ins boolean not null default true,
  quiet_hours_start text not null default '22:00',
  quiet_hours_end text not null default '07:00',
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_execution_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  protocol_id uuid references public.optimization_protocols(id) on delete set null,
  plan_date date not null default current_date,
  status text not null default 'prepared' check (status in ('draft', 'prepared', 'accepted', 'adjusted', 'skipped', 'auto_scheduled')),
  autopilot_mode text not null default 'approve',
  summary text,
  plan jsonb not null default '{}'::jsonb,
  scheduled_event_ids uuid[] not null default '{}',
  accepted_at timestamptz,
  skipped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plan_date)
);

alter table public.autopilot_preferences enable row level security;
alter table public.daily_execution_plans enable row level security;

grant select, insert, update, delete on public.autopilot_preferences to authenticated;
grant select, insert, update, delete on public.daily_execution_plans to authenticated;

create index if not exists daily_execution_plans_user_date_idx
  on public.daily_execution_plans (user_id, plan_date desc);

create index if not exists daily_execution_plans_user_status_idx
  on public.daily_execution_plans (user_id, status, updated_at desc);

drop policy if exists "Users can read own autopilot preferences"
  on public.autopilot_preferences;
create policy "Users can read own autopilot preferences"
  on public.autopilot_preferences
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own autopilot preferences"
  on public.autopilot_preferences;
create policy "Users can insert own autopilot preferences"
  on public.autopilot_preferences
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own autopilot preferences"
  on public.autopilot_preferences;
create policy "Users can update own autopilot preferences"
  on public.autopilot_preferences
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own autopilot preferences"
  on public.autopilot_preferences;
create policy "Users can delete own autopilot preferences"
  on public.autopilot_preferences
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can read own daily execution plans"
  on public.daily_execution_plans;
create policy "Users can read own daily execution plans"
  on public.daily_execution_plans
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own daily execution plans"
  on public.daily_execution_plans;
create policy "Users can insert own daily execution plans"
  on public.daily_execution_plans
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own daily execution plans"
  on public.daily_execution_plans;
create policy "Users can update own daily execution plans"
  on public.daily_execution_plans
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own daily execution plans"
  on public.daily_execution_plans;
create policy "Users can delete own daily execution plans"
  on public.daily_execution_plans
  for delete
  to authenticated
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
