delete from public.health_profile_access hpa
using public.health_profiles profile,
  public.workspaces workspace
where profile.id = hpa.health_profile_id
  and workspace.id = profile.workspace_id
  and workspace.workspace_type = 'organization';

create or replace function app_private.reject_organization_health_profile_access()
returns trigger
language plpgsql
security invoker
set search_path = public, app_private
as $$
begin
  if exists (
    select 1
    from public.health_profiles profile
    join public.workspaces workspace
      on workspace.id = profile.workspace_id
    where profile.id = new.health_profile_id
      and workspace.workspace_type = 'organization'
  ) then
    raise exception 'organization health profiles are not consumer active profiles';
  end if;

  return new;
end;
$$;

drop trigger if exists reject_organization_health_profile_access
  on public.health_profile_access;

create trigger reject_organization_health_profile_access
  before insert or update of workspace_id, health_profile_id, user_id, status
  on public.health_profile_access
  for each row
  execute function app_private.reject_organization_health_profile_access();

notify pgrst, 'reload schema';
