alter table public.concierge_onboarding_requests
  add column if not exists fulfillment_stage text not null default 'intake_pending'
    check (
      fulfillment_stage in (
        'intake_pending',
        'kickoff_scheduled',
        'data_collection',
        'clinician_packet',
        'protocol_build',
        'active_support',
        'complete'
      )
    ),
  add column if not exists fulfillment_checklist jsonb not null default '[
    {"key":"lab_intake","label":"Lab intake","status":"pending"},
    {"key":"wearable_setup","label":"Wearable setup","status":"pending"},
    {"key":"clinician_export","label":"Clinician export","status":"pending"},
    {"key":"first_30_day_protocol","label":"First 30-day protocol","status":"pending"}
  ]'::jsonb,
  add column if not exists concierge_notes text;

create index if not exists concierge_onboarding_requests_fulfillment_stage_idx
  on public.concierge_onboarding_requests (fulfillment_stage, created_at desc);

notify pgrst, 'reload schema';
