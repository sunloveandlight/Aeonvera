do $$
begin
  if to_regclass('public.waitlist') is not null then
    alter table public.waitlist enable row level security;

    drop policy if exists "allow public insert" on public.waitlist;
    create policy "Allow public waitlist signups"
      on public.waitlist
      for insert
      to anon, authenticated
      with check (true);
  end if;

  if to_regclass('public.health_conditions') is not null then
    alter table public.health_conditions enable row level security;

    drop policy if exists "Users can read own health conditions" on public.health_conditions;
    create policy "Users can read own health conditions"
      on public.health_conditions
      for select
      to authenticated
      using (user_id = (select auth.uid()));

    drop policy if exists "Users can insert own health conditions" on public.health_conditions;
    create policy "Users can insert own health conditions"
      on public.health_conditions
      for insert
      to authenticated
      with check (user_id = (select auth.uid()));

    drop policy if exists "Users can update own health conditions" on public.health_conditions;
    create policy "Users can update own health conditions"
      on public.health_conditions
      for update
      to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));

    drop policy if exists "Users can delete own health conditions" on public.health_conditions;
    create policy "Users can delete own health conditions"
      on public.health_conditions
      for delete
      to authenticated
      using (user_id = (select auth.uid()));
  end if;

  if to_regclass('public.wearable_metrics') is not null then
    alter table public.wearable_metrics enable row level security;

    drop policy if exists "Users can read own wearable metrics" on public.wearable_metrics;
    create policy "Users can read own wearable metrics"
      on public.wearable_metrics
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
            where hpa.health_profile_id = wearable_metrics.health_profile_id
              and hpa.user_id = (select auth.uid())
              and hpa.status = 'active'
              and hp.status = 'active'
              and wm.status = 'active'
          )
        )
      );

    drop policy if exists "Users can insert own wearable metrics" on public.wearable_metrics;
    create policy "Users can insert own wearable metrics"
      on public.wearable_metrics
      for insert
      to authenticated
      with check (
        user_id = (select auth.uid())
        and (
          health_profile_id is null
          or exists (
            select 1
            from public.health_profile_access hpa
            where hpa.health_profile_id = wearable_metrics.health_profile_id
              and hpa.user_id = (select auth.uid())
              and hpa.status = 'active'
              and hpa.role in ('owner', 'editor')
          )
        )
      );

    drop policy if exists "Users can update own wearable metrics" on public.wearable_metrics;
    create policy "Users can update own wearable metrics"
      on public.wearable_metrics
      for update
      to authenticated
      using (
        user_id = (select auth.uid())
        and (
          health_profile_id is null
          or exists (
            select 1
            from public.health_profile_access hpa
            where hpa.health_profile_id = wearable_metrics.health_profile_id
              and hpa.user_id = (select auth.uid())
              and hpa.status = 'active'
              and hpa.role in ('owner', 'editor')
          )
        )
      )
      with check (
        user_id = (select auth.uid())
        and (
          health_profile_id is null
          or exists (
            select 1
            from public.health_profile_access hpa
            where hpa.health_profile_id = wearable_metrics.health_profile_id
              and hpa.user_id = (select auth.uid())
              and hpa.status = 'active'
              and hpa.role in ('owner', 'editor')
          )
        )
      );

    drop policy if exists "Users can delete own wearable metrics" on public.wearable_metrics;
    create policy "Users can delete own wearable metrics"
      on public.wearable_metrics
      for delete
      to authenticated
      using (
        user_id = (select auth.uid())
        and (
          health_profile_id is null
          or exists (
            select 1
            from public.health_profile_access hpa
            where hpa.health_profile_id = wearable_metrics.health_profile_id
              and hpa.user_id = (select auth.uid())
              and hpa.status = 'active'
              and hpa.role in ('owner', 'editor')
          )
        )
      );
  end if;

  if to_regclass('public.protocol_items') is not null then
    alter table public.protocol_items enable row level security;

    drop policy if exists "Users manage own protocol items" on public.protocol_items;

    create policy "Users can read own protocol items"
      on public.protocol_items
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.protocols p
          where p.id = protocol_items.protocol_id
            and p.user_id = (select auth.uid())
        )
      );

    create policy "Users can insert own protocol items"
      on public.protocol_items
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.protocols p
          where p.id = protocol_items.protocol_id
            and p.user_id = (select auth.uid())
        )
      );

    create policy "Users can update own protocol items"
      on public.protocol_items
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.protocols p
          where p.id = protocol_items.protocol_id
            and p.user_id = (select auth.uid())
        )
      )
      with check (
        exists (
          select 1
          from public.protocols p
          where p.id = protocol_items.protocol_id
            and p.user_id = (select auth.uid())
        )
      );

    create policy "Users can delete own protocol items"
      on public.protocol_items
      for delete
      to authenticated
      using (
        exists (
          select 1
          from public.protocols p
          where p.id = protocol_items.protocol_id
            and p.user_id = (select auth.uid())
        )
      );
  end if;
end $$;

do $$
begin
  if to_regprocedure('public.match_semantic_memories(vector,integer,double precision)') is not null then
    alter function public.match_semantic_memories(vector,integer,double precision)
      set search_path = public, extensions;
  end if;

  if to_regprocedure('public.match_semantic_memories_for_user(uuid,vector,integer,double precision)') is not null then
    alter function public.match_semantic_memories_for_user(uuid,vector,integer,double precision)
      set search_path = public, extensions;
  end if;
end $$;

notify pgrst, 'reload schema';
