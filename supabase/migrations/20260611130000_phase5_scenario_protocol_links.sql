alter table public.future_self_scenarios
  add column if not exists parent_scenario_id uuid references public.future_self_scenarios(id) on delete set null,
  add column if not exists version_number integer not null default 1,
  add column if not exists protocol_id uuid references public.optimization_protocols(id) on delete set null;

create index if not exists future_self_scenarios_parent_version_idx
  on public.future_self_scenarios (parent_scenario_id, version_number desc);

create index if not exists future_self_scenarios_protocol_idx
  on public.future_self_scenarios (protocol_id);

notify pgrst, 'reload schema';
