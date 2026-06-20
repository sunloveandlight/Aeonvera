create schema if not exists app_private;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Aeonvera workspace',
  plan text not null default 'core' check (plan in ('core', 'elite', 'sovereign')),
  subscription_status text not null default 'inactive' check (
    subscription_status in ('active', 'trialing', 'past_due', 'canceled', 'inactive')
  ),
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  current_period_end timestamptz,
  max_health_profiles integer not null default 1 check (max_health_profiles > 0),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id)
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  status text not null default 'active' check (status in ('active', 'invited', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.health_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  legacy_user_id uuid references auth.users(id) on delete set null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  display_name text,
  relationship text not null default 'self' check (
    relationship in ('self', 'partner', 'child', 'parent', 'family', 'client', 'other')
  ),
  is_primary boolean not null default false,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.health_profile_access (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  health_profile_id uuid not null references public.health_profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'editor', 'viewer')),
  status text not null default 'active' check (status in ('active', 'invited', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (health_profile_id, user_id)
);

create unique index if not exists workspaces_stripe_customer_id_unique
  on public.workspaces (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists workspaces_stripe_subscription_id_unique
  on public.workspaces (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists workspace_members_user_status_idx
  on public.workspace_members (user_id, status);

create index if not exists workspace_members_workspace_role_idx
  on public.workspace_members (workspace_id, role, status);

create unique index if not exists health_profiles_legacy_user_id_unique
  on public.health_profiles (legacy_user_id)
  where legacy_user_id is not null;

create unique index if not exists health_profiles_primary_workspace_unique
  on public.health_profiles (workspace_id)
  where is_primary and status = 'active';

create index if not exists health_profiles_workspace_status_idx
  on public.health_profiles (workspace_id, status);

create index if not exists health_profile_access_user_status_idx
  on public.health_profile_access (user_id, status);

create index if not exists health_profile_access_workspace_user_idx
  on public.health_profile_access (workspace_id, user_id, status);

create or replace function app_private.can_access_workspace(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.status = 'active'
  );
$$;

create or replace function app_private.can_manage_workspace(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.status = 'active'
      and wm.role in ('owner', 'admin')
  );
$$;

create or replace function app_private.can_access_health_profile(target_health_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select exists (
    select 1
    from public.health_profile_access hpa
    join public.health_profiles hp
      on hp.id = hpa.health_profile_id
    join public.workspace_members wm
      on wm.workspace_id = hpa.workspace_id
     and wm.user_id = hpa.user_id
    where hpa.health_profile_id = target_health_profile_id
      and hpa.user_id = (select auth.uid())
      and hpa.status = 'active'
      and hp.status = 'active'
      and wm.status = 'active'
  );
$$;

create or replace function app_private.can_manage_health_profile(target_health_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select exists (
    select 1
    from public.health_profile_access hpa
    join public.health_profiles hp
      on hp.id = hpa.health_profile_id
    join public.workspace_members wm
      on wm.workspace_id = hpa.workspace_id
     and wm.user_id = hpa.user_id
    where hpa.health_profile_id = target_health_profile_id
      and hpa.user_id = (select auth.uid())
      and hpa.status = 'active'
      and hpa.role in ('owner', 'editor')
      and hp.status = 'active'
      and wm.status = 'active'
      and wm.role in ('owner', 'admin', 'member')
  );
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.health_profiles enable row level security;
alter table public.health_profile_access enable row level security;

grant usage on schema app_private to authenticated;
grant execute on all functions in schema app_private to authenticated;

grant select, insert, update on public.workspaces to authenticated;
grant select, insert, update on public.workspace_members to authenticated;
grant select, insert, update on public.health_profiles to authenticated;
grant select, insert, update on public.health_profile_access to authenticated;

drop policy if exists "Workspace members can read workspaces"
  on public.workspaces;
create policy "Workspace members can read workspaces"
  on public.workspaces
  for select
  to authenticated
  using (
    owner_user_id = (select auth.uid())
    or (select app_private.can_access_workspace(id))
  );

drop policy if exists "Users can create owned workspaces"
  on public.workspaces;
create policy "Users can create owned workspaces"
  on public.workspaces
  for insert
  to authenticated
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Workspace admins can update workspaces"
  on public.workspaces;
create policy "Workspace admins can update workspaces"
  on public.workspaces
  for update
  to authenticated
  using (
    owner_user_id = (select auth.uid())
    or (select app_private.can_manage_workspace(id))
  )
  with check (
    owner_user_id = (select auth.uid())
    or (select app_private.can_manage_workspace(id))
  );

drop policy if exists "Workspace members can read memberships"
  on public.workspace_members;
create policy "Workspace members can read memberships"
  on public.workspace_members
  for select
  to authenticated
  using ((select app_private.can_access_workspace(workspace_id)));

drop policy if exists "Workspace admins can add memberships"
  on public.workspace_members;
create policy "Workspace admins can add memberships"
  on public.workspace_members
  for insert
  to authenticated
  with check (
    (select app_private.can_manage_workspace(workspace_id))
    or (
      user_id = (select auth.uid())
      and role = 'owner'
      and exists (
        select 1
        from public.workspaces w
        where w.id = workspace_id
          and w.owner_user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Workspace admins can update memberships"
  on public.workspace_members;
create policy "Workspace admins can update memberships"
  on public.workspace_members
  for update
  to authenticated
  using ((select app_private.can_manage_workspace(workspace_id)))
  with check ((select app_private.can_manage_workspace(workspace_id)));

drop policy if exists "Users can read accessible health profiles"
  on public.health_profiles;
create policy "Users can read accessible health profiles"
  on public.health_profiles
  for select
  to authenticated
  using ((select app_private.can_access_health_profile(id)));

drop policy if exists "Workspace admins can create health profiles"
  on public.health_profiles;
create policy "Workspace admins can create health profiles"
  on public.health_profiles
  for insert
  to authenticated
  with check ((select app_private.can_manage_workspace(workspace_id)));

drop policy if exists "Profile managers can update health profiles"
  on public.health_profiles;
create policy "Profile managers can update health profiles"
  on public.health_profiles
  for update
  to authenticated
  using ((select app_private.can_manage_health_profile(id)))
  with check ((select app_private.can_manage_health_profile(id)));

drop policy if exists "Users can read own profile access"
  on public.health_profile_access;
create policy "Users can read own profile access"
  on public.health_profile_access
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select app_private.can_manage_workspace(workspace_id))
  );

drop policy if exists "Workspace admins can grant profile access"
  on public.health_profile_access;
create policy "Workspace admins can grant profile access"
  on public.health_profile_access
  for insert
  to authenticated
  with check (
    (select app_private.can_manage_workspace(workspace_id))
    and exists (
      select 1
      from public.health_profiles hp
      where hp.id = health_profile_id
        and hp.workspace_id = health_profile_access.workspace_id
    )
  );

drop policy if exists "Workspace admins can update profile access"
  on public.health_profile_access;
create policy "Workspace admins can update profile access"
  on public.health_profile_access
  for update
  to authenticated
  using ((select app_private.can_manage_workspace(workspace_id)))
  with check ((select app_private.can_manage_workspace(workspace_id)));

do $$
declare
  profiles_exists boolean;
  has_display_name boolean;
  has_plan boolean;
  has_subscription_status boolean;
  has_stripe_customer_id boolean;
  has_stripe_subscription_id boolean;
  has_stripe_price_id boolean;
begin
  profiles_exists := to_regclass('public.profiles') is not null;

  if profiles_exists then
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'display_name'
    ) into has_display_name;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'plan'
    ) into has_plan;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'subscription_status'
    ) into has_subscription_status;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'stripe_customer_id'
    ) into has_stripe_customer_id;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'stripe_subscription_id'
    ) into has_stripe_subscription_id;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'stripe_price_id'
    ) into has_stripe_price_id;

    execute format(
      $sql$
        insert into public.workspaces (
          owner_user_id,
          name,
          plan,
          subscription_status,
          stripe_customer_id,
          stripe_subscription_id,
          stripe_price_id,
          max_health_profiles
        )
        select
          p.user_id,
          coalesce(nullif(%1$s, '') || '''s workspace', 'Aeonvera workspace'),
          case
            when %2$s in ('core', 'elite', 'sovereign') then %2$s
            else 'core'
          end,
          case
            when %3$s in ('active', 'trialing', 'past_due', 'canceled', 'inactive') then %3$s
            else 'inactive'
          end,
          %4$s,
          %5$s,
          %6$s,
          case
            when %2$s = 'sovereign' then 10
            when %2$s = 'elite' then 4
            else 1
          end
        from public.profiles p
        where p.user_id is not null
        on conflict (owner_user_id) do update
          set plan = excluded.plan,
              subscription_status = excluded.subscription_status,
              stripe_customer_id = coalesce(excluded.stripe_customer_id, public.workspaces.stripe_customer_id),
              stripe_subscription_id = coalesce(excluded.stripe_subscription_id, public.workspaces.stripe_subscription_id),
              stripe_price_id = coalesce(excluded.stripe_price_id, public.workspaces.stripe_price_id),
              max_health_profiles = excluded.max_health_profiles,
              updated_at = now()
      $sql$,
      case when has_display_name then 'p.display_name' else 'null::text' end,
      case when has_plan then 'p.plan' else '''core''::text' end,
      case when has_subscription_status then 'p.subscription_status' else '''inactive''::text' end,
      case when has_stripe_customer_id then 'p.stripe_customer_id' else 'null::text' end,
      case when has_stripe_subscription_id then 'p.stripe_subscription_id' else 'null::text' end,
      case when has_stripe_price_id then 'p.stripe_price_id' else 'null::text' end
    );

    execute format(
      $sql$
        insert into public.health_profiles (
          workspace_id,
          legacy_user_id,
          created_by_user_id,
          display_name,
          relationship,
          is_primary
        )
        select
          w.id,
          p.user_id,
          p.user_id,
          %1$s,
          'self',
          true
        from public.profiles p
        join public.workspaces w
          on w.owner_user_id = p.user_id
        where p.user_id is not null
        on conflict (legacy_user_id) where legacy_user_id is not null do update
          set display_name = coalesce(excluded.display_name, public.health_profiles.display_name),
              updated_at = now()
      $sql$,
      case when has_display_name then 'p.display_name' else 'null::text' end
    );
  else
    insert into public.workspaces (owner_user_id, name)
    select u.id, 'Aeonvera workspace'
    from auth.users u
    on conflict (owner_user_id) do nothing;

    insert into public.health_profiles (
      workspace_id,
      legacy_user_id,
      created_by_user_id,
      display_name,
      relationship,
      is_primary
    )
    select
      w.id,
      w.owner_user_id,
      w.owner_user_id,
      null,
      'self',
      true
    from public.workspaces w
    on conflict (legacy_user_id) where legacy_user_id is not null do nothing;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, status)
  select w.id, w.owner_user_id, 'owner', 'active'
  from public.workspaces w
  on conflict (workspace_id, user_id) do update
    set role = 'owner',
        status = 'active',
        updated_at = now();

  insert into public.health_profile_access (
    workspace_id,
    health_profile_id,
    user_id,
    role,
    status
  )
  select hp.workspace_id, hp.id, coalesce(hp.legacy_user_id, hp.created_by_user_id), 'owner', 'active'
  from public.health_profiles hp
  where coalesce(hp.legacy_user_id, hp.created_by_user_id) is not null
  on conflict (health_profile_id, user_id) do update
    set role = 'owner',
        status = 'active',
        updated_at = now();
end $$;
