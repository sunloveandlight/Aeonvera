create table if not exists public.agent_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (
    category in (
      'schedule_preference',
      'avoidance',
      'motivation',
      'notification_timing',
      'plan_intensity',
      'reschedule_intent',
      'general'
    )
  ),
  preference_key text not null,
  preference_value text not null,
  source text not null default 'agent_chat' check (source in ('agent_chat', 'mobile', 'web', 'system')),
  confidence numeric not null default 0.7,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category, preference_key)
);

alter table public.agent_preferences enable row level security;

grant select, insert, update, delete on public.agent_preferences to authenticated;

create index if not exists agent_preferences_user_category_idx
  on public.agent_preferences (user_id, category, updated_at desc);

drop policy if exists "Users can read own agent preferences"
  on public.agent_preferences;
create policy "Users can read own agent preferences"
  on public.agent_preferences
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own agent preferences"
  on public.agent_preferences;
create policy "Users can insert own agent preferences"
  on public.agent_preferences
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own agent preferences"
  on public.agent_preferences;
create policy "Users can update own agent preferences"
  on public.agent_preferences
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own agent preferences"
  on public.agent_preferences;
create policy "Users can delete own agent preferences"
  on public.agent_preferences
  for delete
  to authenticated
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
