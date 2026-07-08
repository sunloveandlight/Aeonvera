with duplicate_connections as (
  select
    id,
    row_number() over (
      partition by user_id, health_profile_id, provider
      order by updated_at desc nulls last, connected_at desc nulls last, id desc
    ) as duplicate_rank
  from public.wearable_connections
)
delete from public.wearable_connections wearable_connections
using duplicate_connections
where wearable_connections.id = duplicate_connections.id
  and duplicate_connections.duplicate_rank > 1;

alter table public.wearable_connections
  drop constraint if exists wearable_connections_user_id_provider_key;

drop index if exists wearable_connections_user_profile_provider_unique;

create unique index wearable_connections_user_profile_provider_unique
  on public.wearable_connections (user_id, health_profile_id, provider)
  nulls not distinct;

alter table public.organization_profile_consents
  drop constraint if exists organization_profile_consents_documented_sensitive_basis_chk;

alter table public.organization_profile_consents
  add constraint organization_profile_consents_documented_sensitive_basis_chk
  check (
    not (
      data_classes && array[
        'clinical_summary',
        'labs_basic',
        'labs_sensitive',
        'mental_health',
        'documents',
        'notes'
      ]::text[]
      and nullif(btrim(coalesce(source_document_url, '')), '') is null
      and nullif(btrim(coalesce(source_document_hash, '')), '') is null
      and not (
        legal_basis in ('patient_consent', 'guardian_consent')
        and capture_method = 'in_app'
        and granted_by_user_id is not null
      )
    )
  ) not valid;

notify pgrst, 'reload schema';
