do $$
declare
  policy_record record;
begin
  for policy_record in
    select
      schemaname,
      tablename,
      policyname
    from pg_policies policies
    where schemaname = 'public'
      and policyname not like 'Profile subject % access'
      and roles @> array['authenticated']::name[]
      and not (
        tablename = 'future_self_scenarios'
        and policyname ilike '%public%'
      )
      and exists (
        select 1
        from pg_policies profile_policies
        where profile_policies.schemaname = policies.schemaname
          and profile_policies.tablename = policies.tablename
          and profile_policies.policyname = 'Profile subject read access'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end $$;

do $$
begin
  if to_regclass('public.future_self_scenarios') is not null then
    drop policy if exists "Profile subject read access" on public.future_self_scenarios;
    drop policy if exists "Users can read own or public future self scenarios" on public.future_self_scenarios;

    create policy "Future self scenario read access"
      on public.future_self_scenarios
      for select
      to authenticated
      using (
        is_public = true
        or user_id = (select auth.uid())
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
            where hpa.health_profile_id = future_self_scenarios.health_profile_id
              and hpa.user_id = (select auth.uid())
              and hpa.status = 'active'
              and hp.status = 'active'
              and wm.status = 'active'
          )
        )
      );
  end if;
end $$;

notify pgrst, 'reload schema';
