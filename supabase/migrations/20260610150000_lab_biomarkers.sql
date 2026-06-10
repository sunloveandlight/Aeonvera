create table if not exists public.lab_biomarkers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  canonical_key text not null check (
    canonical_key in (
      'albumin',
      'creatinine',
      'fasting_glucose',
      'hscrp',
      'lymphocyte_pct',
      'mean_cell_volume',
      'red_cell_distribution_width',
      'alkaline_phosphatase',
      'white_blood_cell_count'
    )
  ),
  value numeric not null,
  unit text,
  raw_label text,
  reference_range text,
  source text not null default 'upload' check (source in ('upload', 'manual', 'image', 'pdf', 'csv', 'text')),
  measured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.lab_biomarkers enable row level security;

grant select, insert on public.lab_biomarkers to authenticated;

create index if not exists lab_biomarkers_user_measured_idx
  on public.lab_biomarkers (user_id, measured_at desc);

create index if not exists lab_biomarkers_user_key_measured_idx
  on public.lab_biomarkers (user_id, canonical_key, measured_at desc);

drop policy if exists "Users can read own lab biomarkers"
  on public.lab_biomarkers;
create policy "Users can read own lab biomarkers"
  on public.lab_biomarkers
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own lab biomarkers"
  on public.lab_biomarkers;
create policy "Users can insert own lab biomarkers"
  on public.lab_biomarkers
  for insert
  to authenticated
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
