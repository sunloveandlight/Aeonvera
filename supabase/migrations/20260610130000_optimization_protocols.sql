create table if not exists public.optimization_intakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  context text,
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.optimization_protocols (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  intake_id uuid references public.optimization_intakes(id) on delete set null,
  protocol jsonb not null default '{}'::jsonb,
  summary text,
  focus_domains text[] not null default '{}',
  status text not null default 'generated' check (status in ('generated', 'fallback', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.optimization_intakes enable row level security;
alter table public.optimization_protocols enable row level security;

grant select, insert on public.optimization_intakes to authenticated;
grant select on public.optimization_protocols to authenticated;

create index if not exists optimization_intakes_user_created_idx
  on public.optimization_intakes (user_id, created_at desc);

create index if not exists optimization_protocols_user_created_idx
  on public.optimization_protocols (user_id, created_at desc);

drop policy if exists "Users can read own optimization intakes"
  on public.optimization_intakes;
create policy "Users can read own optimization intakes"
  on public.optimization_intakes
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own optimization intakes"
  on public.optimization_intakes;
create policy "Users can insert own optimization intakes"
  on public.optimization_intakes
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own optimization protocols"
  on public.optimization_protocols;
create policy "Users can read own optimization protocols"
  on public.optimization_protocols
  for select
  to authenticated
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
