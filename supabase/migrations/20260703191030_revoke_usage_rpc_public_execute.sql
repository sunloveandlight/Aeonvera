revoke execute on function public.record_usage_event_if_available(
  uuid,
  text,
  text,
  integer,
  timestamptz,
  uuid,
  jsonb
) from anon, authenticated, public;

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
