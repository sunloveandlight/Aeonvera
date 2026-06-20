do $$
declare
  policy_record record;
  new_using text;
  new_check text;
  sql text;
begin
  for policy_record in
    select
      schemaname,
      tablename,
      policyname,
      cmd,
      roles,
      qual,
      with_check
    from pg_policies
    where schemaname = 'public'
      and (
        (
          qual like '%auth.uid()%'
          and qual not ilike '%select auth.uid()%'
        )
        or (
          with_check like '%auth.uid()%'
          and with_check not ilike '%select auth.uid()%'
        )
      )
    order by schemaname, tablename, policyname
  loop
    new_using := case
      when policy_record.qual is null then null
      else replace(policy_record.qual, 'auth.uid()', '(select auth.uid())')
    end;
    new_check := case
      when policy_record.with_check is null then null
      else replace(policy_record.with_check, 'auth.uid()', '(select auth.uid())')
    end;

    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );

    sql := format(
      'create policy %I on %I.%I for %s to %s',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename,
      policy_record.cmd,
      array_to_string(policy_record.roles, ', ')
    );

    if new_using is not null then
      sql := sql || format(' using (%s)', new_using);
    end if;

    if new_check is not null then
      sql := sql || format(' with check (%s)', new_check);
    end if;

    execute sql;
  end loop;
end $$;

notify pgrst, 'reload schema';
