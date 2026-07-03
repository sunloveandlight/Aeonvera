create or replace function app_private.reject_client_entitlement_changes()
returns trigger
language plpgsql
security invoker
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
