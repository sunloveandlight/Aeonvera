do $$
declare
  subject_table text;
  subject_tables text[] := array[
    'command_orb_action_events',
    'notification_preferences',
    'push_subscriptions',
    'care_network_memberships',
    'coach_memory_profiles'
  ];
begin
  foreach subject_table in array subject_tables loop
    if to_regclass(format('public.%I', subject_table)) is null then
      continue;
    end if;

    execute format(
      'alter table public.%I add column if not exists health_profile_id uuid references public.health_profiles(id) on delete set null',
      subject_table
    );

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = subject_table
        and column_name = 'user_id'
    ) then
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
    elsif exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = subject_table
        and column_name = 'owner_user_id'
    ) then
      execute format(
        $sql$
          update public.%I subject
          set health_profile_id = hp.id
          from public.health_profiles hp
          where subject.health_profile_id is null
            and subject.owner_user_id = hp.legacy_user_id
            and hp.is_primary = true
            and hp.status = 'active'
        $sql$,
        subject_table
      );
    end if;

    execute format(
      'create index if not exists %I on public.%I (health_profile_id) where health_profile_id is not null',
      subject_table || '_health_profile_idx',
      subject_table
    );
  end loop;
end $$;

do $$
begin
  if to_regclass('public.notification_preferences') is not null then
    alter table public.notification_preferences
      add column if not exists id uuid default gen_random_uuid();

    update public.notification_preferences
    set id = gen_random_uuid()
    where id is null;

    if exists (
       select 1
       from pg_constraint
       where conrelid = 'public.notification_preferences'::regclass
         and conname = 'notification_preferences_pkey'
    ) then
      alter table public.notification_preferences
        drop constraint notification_preferences_pkey;
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.notification_preferences'::regclass
        and conname = 'notification_preferences_pkey'
    ) then
      alter table public.notification_preferences
        add constraint notification_preferences_pkey primary key (id);
    end if;
  end if;
end $$;

do $$
begin
  if to_regclass('public.notification_preferences') is not null then
    create unique index if not exists notification_preferences_user_legacy_unique
      on public.notification_preferences (user_id)
      where health_profile_id is null;

    create unique index if not exists notification_preferences_health_profile_unique
      on public.notification_preferences (health_profile_id)
      where health_profile_id is not null;
  end if;
end $$;

do $$
begin
  if to_regclass('public.coach_memory_profiles') is not null then
    alter table public.coach_memory_profiles
      add column if not exists id uuid default gen_random_uuid();

    update public.coach_memory_profiles
    set id = gen_random_uuid()
    where id is null;

    if exists (
       select 1
       from pg_constraint
       where conrelid = 'public.coach_memory_profiles'::regclass
         and conname = 'coach_memory_profiles_pkey'
    ) then
      alter table public.coach_memory_profiles
        drop constraint coach_memory_profiles_pkey;
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.coach_memory_profiles'::regclass
        and conname = 'coach_memory_profiles_pkey'
    ) then
      alter table public.coach_memory_profiles
        add constraint coach_memory_profiles_pkey primary key (id);
    end if;
  end if;
end $$;

do $$
begin
  if to_regclass('public.coach_memory_profiles') is not null then
    create unique index if not exists coach_memory_profiles_user_legacy_unique
      on public.coach_memory_profiles (user_id)
      where health_profile_id is null;

    create unique index if not exists coach_memory_profiles_health_profile_unique
      on public.coach_memory_profiles (health_profile_id)
      where health_profile_id is not null;
  end if;
end $$;

notify pgrst, 'reload schema';
