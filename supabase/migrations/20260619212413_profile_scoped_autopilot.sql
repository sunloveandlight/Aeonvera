alter table public.daily_execution_plans
  add column if not exists health_profile_id uuid references public.health_profiles(id) on delete set null;

alter table public.autopilot_preferences
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists health_profile_id uuid references public.health_profiles(id) on delete set null;

update public.autopilot_preferences ap
set health_profile_id = hp.id
from public.health_profiles hp
where ap.health_profile_id is null
  and ap.user_id = hp.legacy_user_id
  and hp.is_primary = true
  and hp.status = 'active';

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.daily_execution_plans'::regclass
      and conname = 'daily_execution_plans_user_id_plan_date_key'
  ) then
    alter table public.daily_execution_plans
      drop constraint daily_execution_plans_user_id_plan_date_key;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.autopilot_preferences'::regclass
      and conname = 'autopilot_preferences_pkey'
  ) then
    alter table public.autopilot_preferences
      drop constraint autopilot_preferences_pkey;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.autopilot_preferences'::regclass
      and conname = 'autopilot_preferences_pkey'
  ) then
    alter table public.autopilot_preferences
      add constraint autopilot_preferences_pkey primary key (id);
  end if;
end $$;

create unique index if not exists daily_execution_plans_user_date_legacy_unique
  on public.daily_execution_plans (user_id, plan_date)
  where health_profile_id is null;

create unique index if not exists daily_execution_plans_health_profile_date_unique
  on public.daily_execution_plans (health_profile_id, plan_date)
  where health_profile_id is not null;

create unique index if not exists autopilot_preferences_user_legacy_unique
  on public.autopilot_preferences (user_id)
  where health_profile_id is null;

create unique index if not exists autopilot_preferences_health_profile_unique
  on public.autopilot_preferences (health_profile_id)
  where health_profile_id is not null;

create index if not exists autopilot_preferences_health_profile_idx
  on public.autopilot_preferences (health_profile_id)
  where health_profile_id is not null;

notify pgrst, 'reload schema';
