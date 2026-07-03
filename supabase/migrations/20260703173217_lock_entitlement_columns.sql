create schema if not exists app_private;

create or replace function app_private.reject_client_entitlement_changes()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  if tg_table_name = 'workspaces' then
    if tg_op = 'INSERT' then
      if new.plan is distinct from 'core'
        or new.subscription_status is distinct from 'inactive'
        or new.stripe_customer_id is not null
        or new.stripe_subscription_id is not null
        or new.stripe_price_id is not null
        or new.current_period_end is not null
        or new.max_health_profiles is distinct from 1 then
        raise exception 'Client requests cannot set workspace entitlement fields';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.plan is distinct from old.plan
        or new.subscription_status is distinct from old.subscription_status
        or new.stripe_customer_id is distinct from old.stripe_customer_id
        or new.stripe_subscription_id is distinct from old.stripe_subscription_id
        or new.stripe_price_id is distinct from old.stripe_price_id
        or new.current_period_end is distinct from old.current_period_end
        or new.max_health_profiles is distinct from old.max_health_profiles then
        raise exception 'Client requests cannot update workspace entitlement fields';
      end if;
    end if;
  elsif tg_table_name = 'profiles' then
    if tg_op = 'INSERT' then
      if new.plan is distinct from 'free'
        or new.subscription_status is distinct from 'inactive'
        or new.stripe_customer_id is not null
        or new.stripe_subscription_id is not null then
        raise exception 'Client requests cannot set profile entitlement fields';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.plan is distinct from old.plan
        or new.subscription_status is distinct from old.subscription_status
        or new.stripe_customer_id is distinct from old.stripe_customer_id
        or new.stripe_subscription_id is distinct from old.stripe_subscription_id then
        raise exception 'Client requests cannot update profile entitlement fields';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists reject_client_workspace_entitlement_changes on public.workspaces;
create trigger reject_client_workspace_entitlement_changes
  before insert or update on public.workspaces
  for each row
  execute function app_private.reject_client_entitlement_changes();

drop trigger if exists reject_client_profile_entitlement_changes on public.profiles;
create trigger reject_client_profile_entitlement_changes
  before insert or update on public.profiles
  for each row
  execute function app_private.reject_client_entitlement_changes();

revoke all on public.workspaces from anon, authenticated;
grant select on public.workspaces to authenticated;
grant insert (owner_user_id, name) on public.workspaces to authenticated;
grant update (name, updated_at) on public.workspaces to authenticated;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant insert (
  user_id,
  email,
  display_name,
  full_name,
  date_of_birth,
  sex,
  height_cm,
  weight_kg,
  biological_age,
  activity_level,
  primary_goal,
  onboarding_completed,
  entity_name,
  entity_state,
  life_stage
) on public.profiles to anon, authenticated;
grant update (
  email,
  display_name,
  full_name,
  date_of_birth,
  sex,
  height_cm,
  weight_kg,
  biological_age,
  activity_level,
  primary_goal,
  onboarding_completed,
  entity_name,
  entity_state,
  life_stage,
  last_entity_sync,
  updated_at
) on public.profiles to authenticated;
