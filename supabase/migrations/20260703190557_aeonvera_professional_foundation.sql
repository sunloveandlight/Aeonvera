alter table public.workspaces
  add column if not exists workspace_type text not null default 'personal',
  add column if not exists organization_subtype text;

alter table public.workspaces
  drop constraint if exists workspaces_workspace_type_check,
  add constraint workspaces_workspace_type_check
    check (workspace_type in ('personal', 'organization'));

alter table public.workspaces
  drop constraint if exists workspaces_organization_subtype_check,
  add constraint workspaces_organization_subtype_check
    check (
      (
        workspace_type = 'personal'
        and organization_subtype is null
      )
      or (
        workspace_type = 'organization'
        and organization_subtype in (
          'clinic',
          'sports_team',
          'performance_group',
          'concierge_practice'
        )
      )
    );

alter table public.workspaces
  drop constraint if exists workspaces_owner_user_id_key;

create unique index if not exists workspaces_personal_owner_unique
  on public.workspaces (owner_user_id)
  where workspace_type = 'personal';

create index if not exists workspaces_organization_type_idx
  on public.workspaces (workspace_type, organization_subtype, status);

alter table public.workspace_members
  drop constraint if exists workspace_members_role_check,
  add constraint workspace_members_role_check
    check (
      role in (
        'owner',
        'admin',
        'member',
        'viewer',
        'org_admin',
        'clinician',
        'trainer',
        'coach',
        'front_desk',
        'auditor',
        'read_only'
      )
    );

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
      and wm.role in ('owner', 'admin', 'org_admin')
  );
$$;

create or replace function app_private.can_audit_workspace(target_workspace_id uuid)
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
      and wm.role in ('owner', 'admin', 'org_admin', 'auditor')
  );
$$;

create table if not exists public.organization_profile_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  health_profile_id uuid not null references public.health_profiles(id) on delete cascade,
  staff_user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (
    role in (
      'clinician',
      'trainer',
      'coach',
      'front_desk',
      'auditor',
      'read_only'
    )
  ),
  data_classes text[] not null default '{}',
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or expires_at > starts_at),
  check (
    data_classes <@ array[
      'identity',
      'administrative',
      'readiness',
      'performance',
      'nutrition',
      'clinical_summary',
      'labs_basic',
      'labs_sensitive',
      'mental_health',
      'documents',
      'notes'
    ]::text[]
  )
);

create unique index if not exists organization_profile_assignments_active_unique
  on public.organization_profile_assignments (workspace_id, health_profile_id, staff_user_id, role)
  where revoked_at is null;

create index if not exists organization_profile_assignments_staff_idx
  on public.organization_profile_assignments (staff_user_id, workspace_id, health_profile_id)
  where revoked_at is null;

create index if not exists organization_profile_assignments_profile_idx
  on public.organization_profile_assignments (workspace_id, health_profile_id)
  where revoked_at is null;

create table if not exists public.organization_profile_consents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  health_profile_id uuid not null references public.health_profiles(id) on delete cascade,
  subject_user_id uuid references auth.users(id) on delete set null,
  subject_email text,
  granted_by_user_id uuid references auth.users(id) on delete set null,
  granted_by_guardian_id uuid references auth.users(id) on delete set null,
  captured_by_staff_user_id uuid references auth.users(id) on delete set null,
  capture_method text not null check (
    capture_method in (
      'in_app',
      'uploaded_form',
      'esignature',
      'imported_contract',
      'guardian'
    )
  ),
  legal_basis text not null check (
    legal_basis in (
      'patient_consent',
      'guardian_consent',
      'treatment',
      'contract',
      'other'
    )
  ),
  data_classes text[] not null default '{}',
  allowed_roles text[] not null default '{}',
  purpose text not null check (
    purpose in (
      'clinical_care',
      'performance_support',
      'team_operations',
      'research',
      'other'
    )
  ),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by_user_id uuid references auth.users(id) on delete set null,
  revocation_reason text,
  source_document_url text,
  source_document_hash text,
  policy_version text not null default '2026-07-03',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or expires_at > starts_at),
  check (
    data_classes <@ array[
      'identity',
      'administrative',
      'readiness',
      'performance',
      'nutrition',
      'clinical_summary',
      'labs_basic',
      'labs_sensitive',
      'mental_health',
      'documents',
      'notes'
    ]::text[]
  ),
  check (
    allowed_roles <@ array[
      'clinician',
      'trainer',
      'coach',
      'front_desk',
      'auditor',
      'read_only'
    ]::text[]
  )
);

create index if not exists organization_profile_consents_active_idx
  on public.organization_profile_consents (workspace_id, health_profile_id, starts_at, expires_at)
  where revoked_at is null;

create index if not exists organization_profile_consents_subject_user_idx
  on public.organization_profile_consents (subject_user_id)
  where subject_user_id is not null;

create table if not exists public.organization_access_audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role text,
  health_profile_id uuid references public.health_profiles(id) on delete set null,
  action text not null check (
    action in (
      'view',
      'export',
      'download',
      'update',
      'assign',
      'revoke',
      'break_glass',
      'authorize'
    )
  ),
  data_classes text[] not null default '{}',
  route text,
  access_decision text not null check (
    access_decision in ('allowed', 'denied', 'redacted')
  ),
  consent_id uuid references public.organization_profile_consents(id) on delete set null,
  assignment_id uuid references public.organization_profile_assignments(id) on delete set null,
  ip_hash text,
  user_agent_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (
    data_classes <@ array[
      'identity',
      'administrative',
      'readiness',
      'performance',
      'nutrition',
      'clinical_summary',
      'labs_basic',
      'labs_sensitive',
      'mental_health',
      'documents',
      'notes'
    ]::text[]
  )
);

create index if not exists organization_access_audit_events_workspace_created_idx
  on public.organization_access_audit_events (workspace_id, created_at desc);

create index if not exists organization_access_audit_events_profile_created_idx
  on public.organization_access_audit_events (health_profile_id, created_at desc)
  where health_profile_id is not null;

create or replace function app_private.reject_organization_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public, app_private
as $$
begin
  raise exception 'Organization audit events are append-only';
end;
$$;

drop trigger if exists reject_organization_audit_update
  on public.organization_access_audit_events;
create trigger reject_organization_audit_update
  before update on public.organization_access_audit_events
  for each row execute function app_private.reject_organization_audit_mutation();

drop trigger if exists reject_organization_audit_delete
  on public.organization_access_audit_events;
create trigger reject_organization_audit_delete
  before delete on public.organization_access_audit_events
  for each row execute function app_private.reject_organization_audit_mutation();

create or replace function app_private.can_select_organization_profile(
  target_workspace_id uuid,
  target_health_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select
    (select app_private.can_manage_workspace(target_workspace_id))
    or exists (
      select 1
      from public.organization_profile_assignments opa
      join public.organization_profile_consents opc
        on opc.workspace_id = opa.workspace_id
       and opc.health_profile_id = opa.health_profile_id
      join public.workspaces w
        on w.id = opa.workspace_id
      join public.health_profiles hp
        on hp.id = opa.health_profile_id
       and hp.workspace_id = opa.workspace_id
      where opa.workspace_id = target_workspace_id
        and opa.health_profile_id = target_health_profile_id
        and opa.staff_user_id = (select auth.uid())
        and opa.revoked_at is null
        and (opa.expires_at is null or opa.expires_at > now())
        and opa.starts_at <= now()
        and opa.data_classes && opc.data_classes
        and opc.allowed_roles @> array[opa.role]::text[]
        and opc.revoked_at is null
        and (opc.expires_at is null or opc.expires_at > now())
        and opc.starts_at <= now()
        and w.workspace_type = 'organization'
        and w.status = 'active'
        and hp.status = 'active'
    );
$$;

alter table public.organization_profile_assignments enable row level security;
alter table public.organization_profile_consents enable row level security;
alter table public.organization_access_audit_events enable row level security;

grant execute on function app_private.can_audit_workspace(uuid) to authenticated;
grant execute on function app_private.can_select_organization_profile(uuid, uuid) to authenticated;

grant select, insert, update on public.organization_profile_assignments to authenticated;
grant select, insert, update on public.organization_profile_consents to authenticated;
grant select on public.organization_access_audit_events to authenticated;

grant select, insert, update, delete on public.organization_profile_assignments to service_role;
grant select, insert, update, delete on public.organization_profile_consents to service_role;
grant select, insert on public.organization_access_audit_events to service_role;

drop policy if exists "Professional staff can read relevant assignments"
  on public.organization_profile_assignments;
create policy "Professional staff can read relevant assignments"
  on public.organization_profile_assignments
  for select
  to authenticated
  using (
    staff_user_id = (select auth.uid())
    or (select app_private.can_manage_workspace(workspace_id))
  );

drop policy if exists "Professional admins can create assignments"
  on public.organization_profile_assignments;
create policy "Professional admins can create assignments"
  on public.organization_profile_assignments
  for insert
  to authenticated
  with check (
    (select app_private.can_manage_workspace(workspace_id))
    and exists (
      select 1
      from public.health_profiles hp
      join public.workspaces w
        on w.id = hp.workspace_id
      where hp.id = health_profile_id
        and hp.workspace_id = organization_profile_assignments.workspace_id
        and hp.status = 'active'
        and w.workspace_type = 'organization'
        and w.status = 'active'
    )
  );

drop policy if exists "Professional admins can update assignments"
  on public.organization_profile_assignments;
create policy "Professional admins can update assignments"
  on public.organization_profile_assignments
  for update
  to authenticated
  using ((select app_private.can_manage_workspace(workspace_id)))
  with check ((select app_private.can_manage_workspace(workspace_id)));

drop policy if exists "Professional users can read relevant consents"
  on public.organization_profile_consents;
create policy "Professional users can read relevant consents"
  on public.organization_profile_consents
  for select
  to authenticated
  using (
    subject_user_id = (select auth.uid())
    or granted_by_user_id = (select auth.uid())
    or granted_by_guardian_id = (select auth.uid())
    or (select app_private.can_manage_workspace(workspace_id))
    or (select app_private.can_select_organization_profile(workspace_id, health_profile_id))
  );

drop policy if exists "Professional admins can create consents"
  on public.organization_profile_consents;
create policy "Professional admins can create consents"
  on public.organization_profile_consents
  for insert
  to authenticated
  with check (
    (select app_private.can_manage_workspace(workspace_id))
    and exists (
      select 1
      from public.health_profiles hp
      join public.workspaces w
        on w.id = hp.workspace_id
      where hp.id = health_profile_id
        and hp.workspace_id = organization_profile_consents.workspace_id
        and hp.status = 'active'
        and w.workspace_type = 'organization'
        and w.status = 'active'
    )
  );

drop policy if exists "Professional admins can update consents"
  on public.organization_profile_consents;
create policy "Professional admins can update consents"
  on public.organization_profile_consents
  for update
  to authenticated
  using ((select app_private.can_manage_workspace(workspace_id)))
  with check ((select app_private.can_manage_workspace(workspace_id)));

drop policy if exists "Professional auditors can read audit events"
  on public.organization_access_audit_events;
create policy "Professional auditors can read audit events"
  on public.organization_access_audit_events
  for select
  to authenticated
  using ((select app_private.can_audit_workspace(workspace_id)));
