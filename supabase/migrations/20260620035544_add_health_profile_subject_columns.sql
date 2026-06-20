do $$
declare
  subject_table text;
  subject_tables text[] := array[
    'wearable_connections',
    'wearable_metrics',
    'health_metrics',
    'health_states',
    'health_alerts',
    'lab_biomarkers',
    'biological_age_history',
    'clinical_insights',
    'optimization_intakes',
    'optimization_protocols',
    'future_self_scenarios',
    'intervention_outcomes',
    'daily_execution_plans',
    'autopilot_preferences',
    'calendar_events',
    'agent_preferences',
    'coach_memory_profiles',
    'semantic_memories',
    'user_personality_state',
    'life_os_domain_profiles',
    'life_os_priorities',
    'physician_share_links',
    'behavior_events',
    'aeonvera_events',
    'conversation_events',
    'coach_outputs',
    'behavior_feedback_events',
    'behavior_learning_events',
    'kernel_execution_log',
    'usage_events',
    'notification_deliveries'
  ];
  has_created_at boolean;
begin
  foreach subject_table in array subject_tables loop
    if to_regclass(format('public.%I', subject_table)) is null then
      continue;
    end if;

    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = subject_table
        and column_name = 'user_id'
    ) then
      continue;
    end if;

    execute format(
      'alter table public.%I add column if not exists health_profile_id uuid references public.health_profiles(id) on delete set null',
      subject_table
    );

    execute format(
      $sql$
        update public.%I subject
        set health_profile_id = hp.id
        from public.health_profiles hp
        where subject.health_profile_id is null
          and subject.user_id = hp.legacy_user_id
          and hp.is_primary = true
          and hp.status = 'active'
      $sql$,
      subject_table
    );

    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = subject_table
        and column_name = 'created_at'
    ) into has_created_at;

    if has_created_at then
      execute format(
        'create index if not exists %I on public.%I (health_profile_id, created_at desc) where health_profile_id is not null',
        subject_table || '_health_profile_created_idx',
        subject_table
      );
    else
      execute format(
        'create index if not exists %I on public.%I (health_profile_id) where health_profile_id is not null',
        subject_table || '_health_profile_idx',
        subject_table
      );
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
