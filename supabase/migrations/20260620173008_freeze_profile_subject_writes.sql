create or replace function app_private.is_health_profile_writable(target_health_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  with ranked_profiles as (
    select
      hp.id,
      row_number() over (
        partition by hp.workspace_id
        order by hp.is_primary desc, hp.created_at asc, hp.id asc
      ) as writable_rank,
      greatest(coalesce(w.max_health_profiles, 1), 1) as max_health_profiles
    from public.health_profiles hp
    join public.workspaces w
      on w.id = hp.workspace_id
    where hp.status = 'active'
      and w.status = 'active'
      and hp.workspace_id = (
        select workspace_id
        from public.health_profiles
        where id = target_health_profile_id
      )
  )
  select coalesce(
    exists (
      select 1
      from ranked_profiles
      where id = target_health_profile_id
        and writable_rank <= max_health_profiles
    ),
    false
  );
$$;

create or replace function app_private.enforce_writable_health_profile()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
begin
  if new.health_profile_id is null then
    return new;
  end if;

  if current_setting('app.bypass_health_profile_freeze', true) = 'on' then
    return new;
  end if;

  if not app_private.is_health_profile_writable(new.health_profile_id) then
    raise exception 'This health profile is frozen on the current membership.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

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
    'notification_deliveries',
    'health_profile_access',
    'longevity_assessments',
    'longevity_reports',
    'command_orb_action_events',
    'notification_preferences',
    'push_subscriptions',
    'care_network_memberships'
  ];
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
        and column_name = 'health_profile_id'
    ) then
      continue;
    end if;

    execute format(
      'drop trigger if exists enforce_writable_health_profile on public.%I',
      subject_table
    );

    execute format(
      'create trigger enforce_writable_health_profile before insert or update of health_profile_id on public.%I for each row execute function app_private.enforce_writable_health_profile()',
      subject_table
    );
  end loop;
end $$;

grant execute on function app_private.is_health_profile_writable(uuid) to authenticated;

notify pgrst, 'reload schema';
