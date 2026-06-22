create table if not exists public.concierge_onboarding_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  health_profile_id uuid references public.health_profiles(id) on delete set null,
  package_tier text not null default 'sovereign_concierge'
    check (package_tier in ('sovereign_concierge')),
  status text not null default 'requested'
    check (status in ('requested', 'reviewing', 'scheduled', 'completed', 'cancelled')),
  requested_scope text[] not null default array[
    'lab_intake',
    'wearable_setup',
    'clinician_export',
    'first_30_day_protocol'
  ]::text[],
  contact_email text,
  notes text,
  source text not null default 'plan_page',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.referral_partner_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  partner_type text not null default 'health_creator'
    check (partner_type in ('physician', 'coach', 'health_creator', 'other')),
  organization_name text,
  audience_size text,
  proposed_channel text,
  contact_email text,
  referral_code text not null default (
    'AV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  ),
  status text not null default 'submitted'
    check (status in ('submitted', 'reviewing', 'approved', 'declined', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists referral_partner_applications_referral_code_key
  on public.referral_partner_applications (referral_code);

create index if not exists concierge_onboarding_requests_user_created_idx
  on public.concierge_onboarding_requests (user_id, created_at desc);

create index if not exists concierge_onboarding_requests_workspace_status_idx
  on public.concierge_onboarding_requests (workspace_id, status)
  where workspace_id is not null;

create index if not exists referral_partner_applications_user_created_idx
  on public.referral_partner_applications (user_id, created_at desc);

create index if not exists referral_partner_applications_workspace_status_idx
  on public.referral_partner_applications (workspace_id, status)
  where workspace_id is not null;

create or replace function app_private.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, app_private
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_concierge_onboarding_requests_updated_at
  on public.concierge_onboarding_requests;
create trigger touch_concierge_onboarding_requests_updated_at
  before update on public.concierge_onboarding_requests
  for each row execute function app_private.touch_updated_at();

drop trigger if exists touch_referral_partner_applications_updated_at
  on public.referral_partner_applications;
create trigger touch_referral_partner_applications_updated_at
  before update on public.referral_partner_applications
  for each row execute function app_private.touch_updated_at();

alter table public.concierge_onboarding_requests enable row level security;
alter table public.referral_partner_applications enable row level security;

drop policy if exists "Users can read own concierge requests"
  on public.concierge_onboarding_requests;
create policy "Users can read own concierge requests"
  on public.concierge_onboarding_requests
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can create own concierge requests"
  on public.concierge_onboarding_requests;
create policy "Users can create own concierge requests"
  on public.concierge_onboarding_requests
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can read own referral applications"
  on public.referral_partner_applications;
create policy "Users can read own referral applications"
  on public.referral_partner_applications
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can create own referral applications"
  on public.referral_partner_applications;
create policy "Users can create own referral applications"
  on public.referral_partner_applications
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

grant select, insert on public.concierge_onboarding_requests to authenticated;
grant select, insert on public.referral_partner_applications to authenticated;
grant execute on function app_private.touch_updated_at() to authenticated;

notify pgrst, 'reload schema';
