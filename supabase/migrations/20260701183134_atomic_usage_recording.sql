create or replace function public.record_usage_event_if_available(
  p_user_id uuid,
  p_meter text,
  p_plan text,
  p_limit integer,
  p_period_start timestamptz,
  p_health_profile_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  allowed boolean,
  used integer,
  remaining integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_used integer;
  lock_key bigint;
begin
  if p_limit <= 0 then
    return query select false, 0, 0;
    return;
  end if;

  lock_key := hashtextextended(p_user_id::text || ':' || p_meter, 0);
  perform pg_advisory_xact_lock(lock_key);

  select count(*)::integer
  into current_used
  from public.usage_events
  where user_id = p_user_id
    and meter = p_meter
    and created_at >= p_period_start;

  if current_used >= p_limit then
    return query select false, current_used, 0;
    return;
  end if;

  insert into public.usage_events (
    health_profile_id,
    user_id,
    meter,
    plan,
    metadata
  )
  values (
    p_health_profile_id,
    p_user_id,
    p_meter,
    p_plan,
    coalesce(p_metadata, '{}'::jsonb)
  );

  current_used := current_used + 1;

  return query select true, current_used, greatest(p_limit - current_used, 0);
end;
$$;

revoke all on function public.record_usage_event_if_available(
  uuid,
  text,
  text,
  integer,
  timestamptz,
  uuid,
  jsonb
) from public;

grant execute on function public.record_usage_event_if_available(
  uuid,
  text,
  text,
  integer,
  timestamptz,
  uuid,
  jsonb
) to service_role;

notify pgrst, 'reload schema';
