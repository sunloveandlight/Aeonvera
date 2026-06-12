create table if not exists public.clinical_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'agent_chat' check (source in ('agent_chat', 'voice_agent', 'system')),
  source_question text,
  answer_summary text,
  domains text[] not null default '{}',
  concern_status text not null default 'active' check (
    concern_status in ('active', 'improving', 'unresolved', 'dismissed', 'monitoring')
  ),
  confidence numeric not null default 0.7,
  signal_map jsonb not null default '[]'::jsonb,
  range_flags jsonb not null default '[]'::jsonb,
  follow_up_questions jsonb not null default '[]'::jsonb,
  recommended_actions jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.clinical_insights enable row level security;

grant select, insert, update, delete on public.clinical_insights to authenticated;

create index if not exists clinical_insights_user_created_idx
  on public.clinical_insights (user_id, created_at desc);

create index if not exists clinical_insights_user_status_idx
  on public.clinical_insights (user_id, concern_status, updated_at desc);

drop policy if exists "Users can read own clinical insights"
  on public.clinical_insights;
create policy "Users can read own clinical insights"
  on public.clinical_insights
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own clinical insights"
  on public.clinical_insights;
create policy "Users can insert own clinical insights"
  on public.clinical_insights
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own clinical insights"
  on public.clinical_insights;
create policy "Users can update own clinical insights"
  on public.clinical_insights
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own clinical insights"
  on public.clinical_insights;
create policy "Users can delete own clinical insights"
  on public.clinical_insights
  for delete
  to authenticated
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
