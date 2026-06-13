alter table public.physician_share_links
  add column if not exists recipient_email text,
  add column if not exists access_code_hash text;

alter table public.care_network_memberships
  add column if not exists access_code_hash text;

notify pgrst, 'reload schema';
