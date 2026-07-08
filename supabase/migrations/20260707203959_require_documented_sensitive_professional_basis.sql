alter table public.organization_profile_consents
  drop constraint if exists organization_profile_consents_documented_sensitive_basis_chk;

alter table public.organization_profile_consents
  add constraint organization_profile_consents_documented_sensitive_basis_chk
  check (
    not (
      legal_basis in ('treatment', 'contract')
      and data_classes && array[
        'clinical_summary',
        'labs_basic',
        'labs_sensitive',
        'mental_health',
        'documents',
        'notes'
      ]::text[]
      and nullif(btrim(coalesce(source_document_url, '')), '') is null
      and nullif(btrim(coalesce(source_document_hash, '')), '') is null
    )
  ) not valid;
