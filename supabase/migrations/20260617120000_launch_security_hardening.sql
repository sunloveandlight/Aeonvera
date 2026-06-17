-- Launch privacy hardening:
-- - Future-self scenarios are private unless explicitly shared.
-- - Shared future-self scenarios are served through server routes, not anon table reads.
-- - OAuth token tables are server-only; API routes expose sanitized connection status.

alter table if exists public.future_self_scenarios
  alter column is_public set default false;

update public.future_self_scenarios
set is_public = false
where is_public = true;

revoke select on public.future_self_scenarios from anon;

drop policy if exists "Public can read shared future-self scenarios"
  on public.future_self_scenarios;

grant select, insert, update, delete on public.future_self_scenarios to authenticated;
grant select, insert, update, delete on public.future_self_scenarios to service_role;

revoke select, insert, update, delete on public.wearable_connections from authenticated;
grant select, insert, update, delete on public.wearable_connections to service_role;

revoke select, insert, update, delete on public.calendar_connections from authenticated;
grant select, insert, update, delete on public.calendar_connections to service_role;

notify pgrst, 'reload schema';
