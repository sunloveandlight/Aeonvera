alter table public.organization_profile_consents
  validate constraint organization_profile_consents_documented_sensitive_basis_chk;

notify pgrst, 'reload schema';
