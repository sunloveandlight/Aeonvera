create table if not exists public.command_orb_action_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null check (
    action_type in (
      'action_error',
      'billing',
      'checkout',
      'create_care_invite',
      'create_physician_share',
      'generate_report',
      'navigation',
      'open_care_network',
      'open_oura',
      'plan_change',
      'plan_options',
      'prepare_today',
      'simplify_plan',
      'sync_oura'
    )
  ),
  source text not null default 'command_orb' check (source in ('command_orb', 'agent_chat', 'voice_agent', 'system')),
  title text not null,
  detail text not null,
  tone text not null default 'info' check (tone in ('success', 'info', 'caution')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.command_orb_action_events enable row level security;

grant select, insert, delete on public.command_orb_action_events to authenticated;

create index if not exists command_orb_action_events_user_created_idx
  on public.command_orb_action_events (user_id, created_at desc);

create index if not exists command_orb_action_events_user_type_idx
  on public.command_orb_action_events (user_id, action_type, created_at desc);

drop policy if exists "Users can read own command orb action events"
  on public.command_orb_action_events;
create policy "Users can read own command orb action events"
  on public.command_orb_action_events
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own command orb action events"
  on public.command_orb_action_events;
create policy "Users can insert own command orb action events"
  on public.command_orb_action_events
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own command orb action events"
  on public.command_orb_action_events;
create policy "Users can delete own command orb action events"
  on public.command_orb_action_events
  for delete
  to authenticated
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
