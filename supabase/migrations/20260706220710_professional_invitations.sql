create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invite_token uuid not null default gen_random_uuid(),
  invite_type text not null check (invite_type in ('staff', 'roster_member')),
  email text not null,
  name text,
  role text not null check (
    role in (
      'member',
      'clinician',
      'trainer',
      'coach',
      'front_desk',
      'auditor',
      'read_only'
    )
  ),
  health_profile_id uuid references public.health_profiles(id) on delete cascade,
  data_classes text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by_user_id uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  revoked_by_user_id uuid references auth.users(id) on delete set null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at),
  check (
    (invite_type = 'staff' and health_profile_id is null and role <> 'member')
    or (invite_type = 'roster_member' and health_profile_id is not null and role = 'member')
  ),
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

create unique index if not exists organization_invitations_invite_token_idx
  on public.organization_invitations (invite_token);

create index if not exists organization_invitations_workspace_status_idx
  on public.organization_invitations (workspace_id, status, created_at desc);

create index if not exists organization_invitations_email_idx
  on public.organization_invitations (lower(email), status);

create index if not exists organization_invitations_profile_idx
  on public.organization_invitations (workspace_id, health_profile_id)
  where health_profile_id is not null;

alter table public.organization_invitations enable row level security;

grant select, insert, update on public.organization_invitations to authenticated;
grant select, insert, update, delete on public.organization_invitations to service_role;

drop policy if exists "Organization admins can read invitations"
  on public.organization_invitations;
create policy "Organization admins can read invitations"
  on public.organization_invitations
  for select
  to authenticated
  using ((select app_private.can_manage_workspace(workspace_id)));

drop policy if exists "Organization admins can create invitations"
  on public.organization_invitations;
create policy "Organization admins can create invitations"
  on public.organization_invitations
  for insert
  to authenticated
  with check ((select app_private.can_manage_workspace(workspace_id)));

drop policy if exists "Organization admins can update invitations"
  on public.organization_invitations;
create policy "Organization admins can update invitations"
  on public.organization_invitations
  for update
  to authenticated
  using ((select app_private.can_manage_workspace(workspace_id)))
  with check ((select app_private.can_manage_workspace(workspace_id)));
