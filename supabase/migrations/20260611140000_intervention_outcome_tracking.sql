alter table public.intervention_outcomes
  add column if not exists protocol_id uuid references public.optimization_protocols(id) on delete set null,
  add column if not exists outcome text not null default 'unknown' check (outcome in ('success', 'failure', 'unknown')),
  add column if not exists baseline_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists followup_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists notes text,
  add column if not exists measured_at timestamptz not null default now();

create index if not exists intervention_outcomes_protocol_created_idx
  on public.intervention_outcomes (protocol_id, created_at desc);

create index if not exists intervention_outcomes_user_measured_idx
  on public.intervention_outcomes (user_id, measured_at desc);

notify pgrst, 'reload schema';
