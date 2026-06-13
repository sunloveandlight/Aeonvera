create table if not exists public.physician_share_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  share_token uuid not null default gen_random_uuid(),
  recipient_label text,
  included_sections text[] not null default array[
    'snapshot',
    'biological_age',
    'labs',
    'protocols',
    'outcomes',
    'wearables',
    'clinical_insights'
  ],
  expires_at timestamptz not null default (now() + interval '14 days'),
  revoked_at timestamptz,
  access_count integer not null default 0,
  last_accessed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.physician_share_links enable row level security;

grant select, insert, update, delete on public.physician_share_links to authenticated;

create unique index if not exists physician_share_links_token_idx
  on public.physician_share_links (share_token);

create index if not exists physician_share_links_user_created_idx
  on public.physician_share_links (user_id, created_at desc);

create index if not exists physician_share_links_active_token_idx
  on public.physician_share_links (share_token, expires_at)
  where revoked_at is null;

drop policy if exists "Users can read own physician share links"
  on public.physician_share_links;
create policy "Users can read own physician share links"
  on public.physician_share_links
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own physician share links"
  on public.physician_share_links;
create policy "Users can insert own physician share links"
  on public.physician_share_links
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own physician share links"
  on public.physician_share_links;
create policy "Users can update own physician share links"
  on public.physician_share_links
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own physician share links"
  on public.physician_share_links;
create policy "Users can delete own physician share links"
  on public.physician_share_links
  for delete
  to authenticated
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
