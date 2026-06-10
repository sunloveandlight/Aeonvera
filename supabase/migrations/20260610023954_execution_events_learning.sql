create table if not exists public.stripe_events (
  id text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.behavior_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text,
  event_type text,
  domain text,
  action text,
  reason text,
  reference text,
  outcome text,
  priority integer,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.aeonvera_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  tone text,
  tags text[] not null default '{}'::text[],
  linked_coach_output_id uuid,
  timestamp timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.coach_outputs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null,
  tone text not null,
  message text not null,
  actions text[] not null default '{}'::text[],
  source text not null check (source in ('runtime', 'cron', 'assessment', 'system')),
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'conversation_events_linked_coach_output_fk'
  ) then
    alter table public.conversation_events
      add constraint conversation_events_linked_coach_output_fk
      foreign key (linked_coach_output_id)
      references public.coach_outputs(id)
      on delete set null;
  end if;
end $$;

create table if not exists public.intervention_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null,
  action text not null,
  success boolean not null default false,
  confidence numeric not null default 0.5,
  created_at timestamptz not null default now()
);

create table if not exists public.behavior_feedback_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null,
  action text not null,
  outcome text not null check (outcome in ('success', 'failure', 'unknown')),
  confidence numeric not null default 0.5,
  created_at timestamptz not null default now()
);

create table if not exists public.behavior_learning_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null,
  action text not null,
  outcome text not null check (outcome in ('success', 'failure', 'unknown')),
  confidence numeric not null default 0.5,
  source text not null check (source in ('execution', 'manual', 'system')),
  created_at timestamptz not null default now()
);

create table if not exists public.user_personality_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  strictness numeric not null default 50,
  empathy numeric not null default 50,
  proactivity numeric not null default 50,
  updated_at timestamptz not null default now()
);

create table if not exists public.kernel_cooldown_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_global_at timestamptz,
  domain_cooldowns jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.kernel_execution_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  approved_count integer not null default 0,
  suppressed_count integer not null default 0,
  fatigue_level integer not null default 0,
  approved_domains text[] not null default '{}'::text[],
  suppressed_reasons text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

alter table public.stripe_events enable row level security;
alter table public.behavior_events enable row level security;
alter table public.aeonvera_events enable row level security;
alter table public.conversation_events enable row level security;
alter table public.coach_outputs enable row level security;
alter table public.intervention_outcomes enable row level security;
alter table public.behavior_feedback_events enable row level security;
alter table public.behavior_learning_events enable row level security;
alter table public.user_personality_state enable row level security;
alter table public.kernel_cooldown_state enable row level security;
alter table public.kernel_execution_log enable row level security;

create index if not exists behavior_events_user_created_idx
  on public.behavior_events (user_id, created_at desc);

create index if not exists aeonvera_events_user_created_idx
  on public.aeonvera_events (user_id, created_at desc);

create index if not exists conversation_events_user_timestamp_idx
  on public.conversation_events (user_id, timestamp desc);

create index if not exists coach_outputs_user_created_idx
  on public.coach_outputs (user_id, created_at desc);

create index if not exists intervention_outcomes_user_created_idx
  on public.intervention_outcomes (user_id, created_at desc);

create index if not exists kernel_execution_log_user_created_idx
  on public.kernel_execution_log (user_id, created_at desc);

grant select, insert, update, delete on
  public.behavior_events,
  public.aeonvera_events,
  public.conversation_events,
  public.coach_outputs,
  public.intervention_outcomes,
  public.behavior_feedback_events,
  public.behavior_learning_events,
  public.user_personality_state,
  public.kernel_cooldown_state,
  public.kernel_execution_log
to authenticated;

create policy "Users can manage own behavior events"
  on public.behavior_events
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own system events"
  on public.aeonvera_events
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own conversation events"
  on public.conversation_events
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own coach outputs"
  on public.coach_outputs
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own intervention outcomes"
  on public.intervention_outcomes
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own feedback events"
  on public.behavior_feedback_events
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own learning events"
  on public.behavior_learning_events
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own personality state"
  on public.user_personality_state
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own kernel cooldown"
  on public.kernel_cooldown_state
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can read own kernel executions"
  on public.kernel_execution_log
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own kernel executions"
  on public.kernel_execution_log
  for insert
  to authenticated
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
