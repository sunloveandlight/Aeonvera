do $$
begin
  if to_regclass('public.agent_preferences') is not null then
    if exists (
      select 1
      from pg_constraint
      where conrelid = 'public.agent_preferences'::regclass
        and conname = 'agent_preferences_user_id_category_preference_key_key'
    ) then
      alter table public.agent_preferences
        drop constraint agent_preferences_user_id_category_preference_key_key;
    end if;

    create unique index if not exists agent_preferences_user_legacy_unique
      on public.agent_preferences (user_id, category, preference_key)
      where health_profile_id is null;

    create unique index if not exists agent_preferences_health_profile_unique
      on public.agent_preferences (health_profile_id, category, preference_key)
      where health_profile_id is not null;

    create index if not exists agent_preferences_health_profile_category_idx
      on public.agent_preferences (health_profile_id, category, updated_at desc)
      where health_profile_id is not null;
  end if;
end $$;

create or replace function public.match_semantic_memories_for_health_profile(
  target_health_profile_id uuid,
  query_embedding extensions.vector,
  match_count int default 8,
  match_threshold float default 0.72
)
returns table (
  id uuid,
  source_type text,
  source_id text,
  title text,
  content text,
  metadata jsonb,
  importance numeric,
  occurred_at timestamptz,
  similarity float
)
language sql
stable
set search_path = public, extensions
as $$
  select
    semantic_memories.id,
    semantic_memories.source_type,
    semantic_memories.source_id,
    semantic_memories.title,
    semantic_memories.content,
    semantic_memories.metadata,
    semantic_memories.importance,
    semantic_memories.occurred_at,
    1 - (semantic_memories.embedding <=> query_embedding) as similarity
  from public.semantic_memories
  where semantic_memories.health_profile_id = target_health_profile_id
    and 1 - (semantic_memories.embedding <=> query_embedding) >= match_threshold
  order by
    (1 - (semantic_memories.embedding <=> query_embedding)) desc,
    semantic_memories.importance desc,
    semantic_memories.created_at desc
  limit least(greatest(match_count, 1), 24);
$$;

revoke execute on function public.match_semantic_memories_for_health_profile(uuid, extensions.vector, int, float)
  from anon, authenticated;
grant execute on function public.match_semantic_memories_for_health_profile(uuid, extensions.vector, int, float)
  to service_role;

notify pgrst, 'reload schema';
