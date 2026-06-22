alter table public.concierge_onboarding_requests
  add column if not exists payment_status text not null default 'not_started'
    check (payment_status in ('not_started', 'checkout_started', 'paid', 'failed', 'refunded')),
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists paid_at timestamptz;

create unique index if not exists concierge_onboarding_requests_checkout_session_key
  on public.concierge_onboarding_requests (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index if not exists concierge_onboarding_requests_payment_status_idx
  on public.concierge_onboarding_requests (payment_status, created_at desc);

notify pgrst, 'reload schema';
