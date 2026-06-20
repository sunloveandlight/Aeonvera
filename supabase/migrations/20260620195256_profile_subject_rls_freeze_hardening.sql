create or replace function app_private.default_subject_health_profile()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
begin
  if new.health_profile_id is not null then
    return new;
  end if;

  if new.user_id is null then
    return new;
  end if;

  select hp.id
    into new.health_profile_id
  from public.health_profiles hp
  join public.health_profile_access hpa
    on hpa.health_profile_id = hp.id
   and hpa.workspace_id = hp.workspace_id
  join public.workspace_members wm
    on wm.workspace_id = hp.workspace_id
   and wm.user_id = hpa.user_id
  where hpa.user_id = new.user_id
    and hpa.status = 'active'
    and hpa.role in ('owner', 'editor')
    and wm.status = 'active'
    and hp.status = 'active'
  order by hp.is_primary desc, hp.created_at asc, hp.id asc
  limit 1;

  return new;
end;
$$;

create or replace function app_private.enforce_writable_health_profile()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
begin
  if current_setting('app.bypass_health_profile_freeze', true) = 'on' then
    return new;
  end if;

  if new.health_profile_id is null then
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
        and column_name = 'user_id'
    ) then
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
      $sql$
        update public.%1$I subject
        set health_profile_id = hp.id
        from public.health_profiles hp
        join public.health_profile_access hpa
          on hpa.health_profile_id = hp.id
         and hpa.workspace_id = hp.workspace_id
        join public.workspace_members wm
          on wm.workspace_id = hp.workspace_id
         and wm.user_id = hpa.user_id
        where subject.health_profile_id is null
          and subject.user_id = hpa.user_id
          and hpa.status = 'active'
          and hpa.role in ('owner', 'editor')
          and wm.status = 'active'
          and hp.status = 'active'
          and hp.is_primary = true
      $sql$,
      subject_table
    );

    execute format('alter table public.%I enable row level security', subject_table);

    execute format('drop trigger if exists default_subject_health_profile on public.%I', subject_table);
    execute format('drop trigger if exists enforce_writable_health_profile on public.%I', subject_table);

    execute format(
      'create trigger default_subject_health_profile before insert or update on public.%I for each row execute function app_private.default_subject_health_profile()',
      subject_table
    );

    execute format(
      'create trigger enforce_writable_health_profile before insert or update on public.%I for each row execute function app_private.enforce_writable_health_profile()',
      subject_table
    );

    execute format('drop policy if exists "Profile subject read access" on public.%I', subject_table);
    execute format('drop policy if exists "Profile subject insert access" on public.%I', subject_table);
    execute format('drop policy if exists "Profile subject update access" on public.%I', subject_table);
    execute format('drop policy if exists "Profile subject delete access" on public.%I', subject_table);

    execute format(
      $sql$
        create policy "Profile subject read access"
          on public.%1$I
          for select
          to authenticated
          using (
            user_id = (select auth.uid())
            or (
              health_profile_id is not null
              and exists (
                select 1
                from public.health_profile_access hpa
                join public.health_profiles hp
                  on hp.id = hpa.health_profile_id
                join public.workspace_members wm
                  on wm.workspace_id = hpa.workspace_id
                 and wm.user_id = hpa.user_id
                where hpa.health_profile_id = %1$I.health_profile_id
                  and hpa.user_id = (select auth.uid())
                  and hpa.status = 'active'
                  and hp.status = 'active'
                  and wm.status = 'active'
              )
            )
          )
      $sql$,
      subject_table
    );

    execute format(
      $sql$
        create policy "Profile subject insert access"
          on public.%1$I
          for insert
          to authenticated
          with check (
            user_id = (select auth.uid())
            and (
              health_profile_id is null
              or (
                app_private.is_health_profile_writable(health_profile_id)
                and exists (
                  select 1
                  from public.health_profile_access hpa
                  join public.health_profiles hp
                    on hp.id = hpa.health_profile_id
                  join public.workspace_members wm
                    on wm.workspace_id = hpa.workspace_id
                   and wm.user_id = hpa.user_id
                  where hpa.health_profile_id = %1$I.health_profile_id
                    and hpa.user_id = (select auth.uid())
                    and hpa.status = 'active'
                    and hpa.role in ('owner', 'editor')
                    and hp.status = 'active'
                    and wm.status = 'active'
                )
              )
            )
          )
      $sql$,
      subject_table
    );

    execute format(
      $sql$
        create policy "Profile subject update access"
          on public.%1$I
          for update
          to authenticated
          using (
            user_id = (select auth.uid())
            and (
              health_profile_id is null
              or (
                app_private.is_health_profile_writable(health_profile_id)
                and exists (
                  select 1
                  from public.health_profile_access hpa
                  join public.health_profiles hp
                    on hp.id = hpa.health_profile_id
                  join public.workspace_members wm
                    on wm.workspace_id = hpa.workspace_id
                   and wm.user_id = hpa.user_id
                  where hpa.health_profile_id = %1$I.health_profile_id
                    and hpa.user_id = (select auth.uid())
                    and hpa.status = 'active'
                    and hpa.role in ('owner', 'editor')
                    and hp.status = 'active'
                    and wm.status = 'active'
                )
              )
            )
          )
          with check (
            user_id = (select auth.uid())
            and (
              health_profile_id is null
              or (
                app_private.is_health_profile_writable(health_profile_id)
                and exists (
                  select 1
                  from public.health_profile_access hpa
                  join public.health_profiles hp
                    on hp.id = hpa.health_profile_id
                  join public.workspace_members wm
                    on wm.workspace_id = hpa.workspace_id
                   and wm.user_id = hpa.user_id
                  where hpa.health_profile_id = %1$I.health_profile_id
                    and hpa.user_id = (select auth.uid())
                    and hpa.status = 'active'
                    and hpa.role in ('owner', 'editor')
                    and hp.status = 'active'
                    and wm.status = 'active'
                )
              )
            )
          )
      $sql$,
      subject_table
    );

    execute format(
      $sql$
        create policy "Profile subject delete access"
          on public.%1$I
          for delete
          to authenticated
          using (
            user_id = (select auth.uid())
            and (
              health_profile_id is null
              or (
                app_private.is_health_profile_writable(health_profile_id)
                and exists (
                  select 1
                  from public.health_profile_access hpa
                  join public.health_profiles hp
                    on hp.id = hpa.health_profile_id
                  join public.workspace_members wm
                    on wm.workspace_id = hpa.workspace_id
                   and wm.user_id = hpa.user_id
                  where hpa.health_profile_id = %1$I.health_profile_id
                    and hpa.user_id = (select auth.uid())
                    and hpa.status = 'active'
                    and hpa.role in ('owner', 'editor')
                    and hp.status = 'active'
                    and wm.status = 'active'
                )
              )
            )
          )
      $sql$,
      subject_table
    );
  end loop;
end $$;

grant execute on function app_private.default_subject_health_profile() to authenticated;
grant execute on function app_private.enforce_writable_health_profile() to authenticated;

notify pgrst, 'reload schema';
