with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, health_profile_id, provider, metric_name, recorded_at
      order by created_at desc nulls last, id desc
    ) as duplicate_rank
  from public.wearable_metrics
)
delete from public.wearable_metrics
where id in (select id from ranked where duplicate_rank > 1);

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, health_profile_id, source, metric, measured_at
      order by created_at desc nulls last, id desc
    ) as duplicate_rank
  from public.health_metrics
)
delete from public.health_metrics
where id in (select id from ranked where duplicate_rank > 1);

create unique index if not exists wearable_metrics_subject_metric_recorded_unique
  on public.wearable_metrics (user_id, health_profile_id, provider, metric_name, recorded_at)
  nulls not distinct;

create unique index if not exists health_metrics_subject_metric_measured_unique
  on public.health_metrics (user_id, health_profile_id, source, metric, measured_at)
  nulls not distinct;
