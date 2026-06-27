create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  first_name text,
  source_path text,
  referrer text,
  user_agent text,
  ip_address text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.waitlist
  add column if not exists first_name text,
  add column if not exists source_path text,
  add column if not exists referrer text,
  add column if not exists user_agent text,
  add column if not exists ip_address text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists last_seen_at timestamptz not null default now();

alter table public.waitlist enable row level security;

grant insert on public.waitlist to anon, authenticated;
grant select, insert, update, delete on public.waitlist to service_role;

drop policy if exists "Allow public waitlist signups" on public.waitlist;
drop policy if exists "allow public insert" on public.waitlist;

create policy "Allow public waitlist signups"
  on public.waitlist
  for insert
  to anon, authenticated
  with check (
    email is not null
    and length(trim(email)) between 5 and 320
    and position('@' in email) > 1
  );

notify pgrst, 'reload schema';
