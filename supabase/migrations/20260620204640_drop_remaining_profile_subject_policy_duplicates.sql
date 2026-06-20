do $$
begin
  if to_regclass('public.health_metrics') is not null then
    drop policy if exists "Users manage own metrics" on public.health_metrics;
  end if;

  if to_regclass('public.longevity_assessments') is not null then
    drop policy if exists "Users manage own assessments" on public.longevity_assessments;
  end if;

  if to_regclass('public.longevity_reports') is not null then
    drop policy if exists "Users manage own reports" on public.longevity_reports;
  end if;
end $$;

notify pgrst, 'reload schema';
