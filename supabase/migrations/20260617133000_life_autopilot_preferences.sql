-- Life Autopilot preference expansion.
-- Extends the existing autopilot_preferences row so behavior orchestration,
-- delivery settings, and scheduling boundaries share one source of truth.

alter table if exists public.autopilot_preferences
  add column if not exists intensity text not null default 'balanced'
    check (intensity in ('quiet', 'balanced', 'high_touch')),
  add column if not exists hydration_target_ml integer not null default 2500
    check (hydration_target_ml between 500 and 6000),
  add column if not exists fasting_window_start text not null default '20:00',
  add column if not exists fasting_window_end text not null default '08:00',
  add column if not exists sleep_window_start text not null default '22:30',
  add column if not exists sleep_window_end text not null default '07:00',
  add column if not exists meal_rhythm text not null default 'three_meals'
    check (meal_rhythm in ('two_meals', 'three_meals', 'protein_anchor', 'custom')),
  add column if not exists sunlight_target_minutes integer not null default 20
    check (sunlight_target_minutes between 0 and 180),
  add column if not exists training_days text[] not null default array['Mon','Wed','Fri']::text[],
  add column if not exists supplement_reminders_enabled boolean not null default false,
  add column if not exists medication_boundary text not null default 'never_medical'
    check (medication_boundary in ('never_medical', 'remind_only', 'clinician_supervised')),
  add column if not exists allowed_reminder_domains jsonb not null default
    '{"hydration":true,"food":true,"fasting":true,"sunlight":true,"sleep":true,"workouts":true,"supplements":false,"recovery":true,"check_ins":true}'::jsonb,
  add column if not exists weekly_review_enabled boolean not null default true,
  add column if not exists streak_tracking_enabled boolean not null default true,
  add column if not exists friction_tracking_enabled boolean not null default true,
  add column if not exists sovereign_onboarding_status jsonb not null default
    '{"white_glove":false,"quarterly_review":false,"priority_support":false,"family_accounts":false,"concierge_import":false}'::jsonb;

grant select, insert, update, delete on public.autopilot_preferences to authenticated;
grant select, insert, update, delete on public.autopilot_preferences to service_role;

notify pgrst, 'reload schema';
