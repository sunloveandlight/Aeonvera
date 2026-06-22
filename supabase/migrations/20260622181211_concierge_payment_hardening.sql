create or replace function app_private.enforce_concierge_request_insert_defaults()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  allowed_scope text[] := array[
    'lab_intake',
    'wearable_setup',
    'clinician_export',
    'first_30_day_protocol'
  ];
begin
  new.package_tier := 'sovereign_concierge';
  new.status := 'requested';
  new.payment_status := 'not_started';
  new.fulfillment_stage := 'intake_pending';
  new.stripe_checkout_session_id := null;
  new.stripe_payment_intent_id := null;
  new.paid_at := null;
  new.concierge_notes := null;
  new.fulfillment_checklist := '[
    {"key":"lab_intake","label":"Lab intake","status":"pending"},
    {"key":"wearable_setup","label":"Wearable setup","status":"pending"},
    {"key":"clinician_export","label":"Clinician export","status":"pending"},
    {"key":"first_30_day_protocol","label":"First 30-day protocol","status":"pending"}
  ]'::jsonb;

  select coalesce(array_agg(scope_item), allowed_scope)
    into new.requested_scope
  from unnest(coalesce(new.requested_scope, allowed_scope)) as scope_item
  where scope_item = any (allowed_scope);

  if array_length(new.requested_scope, 1) is null then
    new.requested_scope := allowed_scope;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_concierge_request_insert_defaults
  on public.concierge_onboarding_requests;
create trigger enforce_concierge_request_insert_defaults
  before insert on public.concierge_onboarding_requests
  for each row execute function app_private.enforce_concierge_request_insert_defaults();

grant execute on function app_private.enforce_concierge_request_insert_defaults() to authenticated;

notify pgrst, 'reload schema';
