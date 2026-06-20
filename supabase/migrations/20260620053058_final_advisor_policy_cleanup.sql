do $$
begin
  if to_regclass('public.waitlist') is not null then
    drop policy if exists "Allow public waitlist signups" on public.waitlist;
    drop policy if exists "allow public insert" on public.waitlist;

    create policy "Allow public waitlist signups"
      on public.waitlist
      for insert
      to anon, authenticated
      with check (
        email is not null
        and length(trim(email)) between 5 and 320
        and position('@' in email) > 1
      );
  end if;

  if to_regclass('public.future_self_scenarios') is not null then
    drop policy if exists "Users can read own future self scenarios"
      on public.future_self_scenarios;
    drop policy if exists "Users can read public future self scenarios"
      on public.future_self_scenarios;
    drop policy if exists "Users can read own or public future self scenarios"
      on public.future_self_scenarios;
    drop policy if exists "Anonymous users can read public future self scenarios"
      on public.future_self_scenarios;

    create policy "Users can read own or public future self scenarios"
      on public.future_self_scenarios
      for select
      to authenticated
      using (
        user_id = (select auth.uid())
        or is_public = true
      );

    create policy "Anonymous users can read public future self scenarios"
      on public.future_self_scenarios
      for select
      to anon
      using (is_public = true);
  end if;
end $$;

notify pgrst, 'reload schema';
