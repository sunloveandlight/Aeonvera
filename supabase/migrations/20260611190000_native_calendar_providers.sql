alter table public.calendar_connections
  drop constraint if exists calendar_connections_provider_check;

alter table public.calendar_connections
  add constraint calendar_connections_provider_check
  check (provider in ('google', 'apple', 'android', 'device'));

alter table public.calendar_events
  drop constraint if exists calendar_events_provider_check;

alter table public.calendar_events
  add constraint calendar_events_provider_check
  check (provider in ('google', 'apple', 'android', 'device'));

notify pgrst, 'reload schema';
