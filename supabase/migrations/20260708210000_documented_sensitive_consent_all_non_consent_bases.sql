-- Defense-in-depth for the professional consent gate.
--
-- The previous constraint only required a source document for sensitive data classes
-- when legal_basis was 'treatment' or 'contract', leaving legal_basis='other' (and any
-- future non-consent basis) able to authorize labs_sensitive / mental_health / etc.
-- with no member grant and no supporting document. The app layer
-- (requiresDocumentedProfessionalBasis) already blocks this; this makes the database the
-- source of truth so a direct/service-role write can't bypass it either.
--
-- Rule: a consent covering any sensitive data class must carry a source document URL/hash
-- UNLESS its legal_basis is member-granted ('patient_consent' / 'guardian_consent'),
-- which is separately validated as an in-app member action or documented consent.

alter table public.organization_profile_consents
  drop constraint if exists organization_profile_consents_documented_sensitive_basis_chk;

alter table public.organization_profile_consents
  add constraint organization_profile_consents_documented_sensitive_basis_chk
  check (
    not (
      legal_basis not in ('patient_consent', 'guardian_consent')
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

notify pgrst, 'reload schema';
