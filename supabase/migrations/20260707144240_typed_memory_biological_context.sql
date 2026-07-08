alter table public.health_profiles
  add column if not exists biological_context jsonb not null default '{}'::jsonb,
  add column if not exists biological_context_updated_at timestamptz;

create or replace function app_private.valid_health_profile_biological_context(context jsonb)
returns boolean
language sql
immutable
as $$
  select
    jsonb_typeof(coalesce(context, '{}'::jsonb)) = 'object'
    and (
      not (coalesce(context, '{}'::jsonb) ? 'biological_sex')
      or context->>'biological_sex' in ('male', 'female', 'intersex', 'unknown', 'prefer_not_to_say')
    )
    and (
      not (coalesce(context, '{}'::jsonb) ? 'life_stage')
      or context->>'life_stage' in (
        'unknown',
        'pediatric',
        'adult',
        'pregnant',
        'postpartum',
        'lactating',
        'perimenopause',
        'postmenopause',
        'gender_affirming_hormone_therapy'
      )
    )
    and (
      not (coalesce(context, '{}'::jsonb) ? 'pregnancy_status')
      or context->>'pregnancy_status' in ('not_pregnant', 'pregnant', 'postpartum', 'unknown', 'prefer_not_to_say')
    )
    and (
      not (coalesce(context, '{}'::jsonb) ? 'lactation_status')
      or context->>'lactation_status' in ('not_lactating', 'lactating', 'unknown', 'prefer_not_to_say')
    )
    and (
      not (coalesce(context, '{}'::jsonb) ? 'menstrual_status')
      or context->>'menstrual_status' in (
        'not_applicable',
        'cycling',
        'irregular',
        'perimenopause',
        'postmenopause',
        'unknown',
        'prefer_not_to_say'
      )
    )
    and (
      not (coalesce(context, '{}'::jsonb) ? 'hormone_therapies')
      or (
        jsonb_typeof(context->'hormone_therapies') = 'array'
        and not exists (
          select 1
          from jsonb_array_elements_text(context->'hormone_therapies') therapy(value)
          where therapy.value not in (
            'none',
            'contraception',
            'menopausal_hormone_therapy',
            'testosterone',
            'estrogen',
            'anti_androgen',
            'puberty_blocker',
            'other',
            'unknown',
            'prefer_not_to_say'
          )
        )
      )
    );
$$;

alter table public.health_profiles
  drop constraint if exists health_profiles_biological_context_valid,
  add constraint health_profiles_biological_context_valid
    check (app_private.valid_health_profile_biological_context(biological_context));

alter table public.semantic_memories
  add column if not exists memory_kind text not null default 'episode'
    check (memory_kind in ('fact', 'preference', 'episode', 'insight', 'biological_context')),
  add column if not exists confidence numeric not null default 0.7
    check (confidence >= 0 and confidence <= 1),
  add column if not exists provenance jsonb not null default '{}'::jsonb,
  add column if not exists expires_at timestamptz,
  add column if not exists superseded_at timestamptz,
  add column if not exists superseded_by uuid references public.semantic_memories(id) on delete set null,
  add column if not exists is_pinned boolean not null default false;

create index if not exists health_profiles_biological_context_idx
  on public.health_profiles using gin (biological_context);

create index if not exists semantic_memories_profile_kind_rank_idx
  on public.semantic_memories (health_profile_id, memory_kind, is_pinned desc, importance desc, occurred_at desc)
  where health_profile_id is not null and superseded_at is null;

create index if not exists semantic_memories_user_legacy_kind_rank_idx
  on public.semantic_memories (user_id, memory_kind, is_pinned desc, importance desc, occurred_at desc)
  where health_profile_id is null and superseded_at is null;

drop policy if exists "Users can read own semantic memories"
  on public.semantic_memories;
drop policy if exists "Users can read own legacy semantic memories"
  on public.semantic_memories;
create policy "Users can read own legacy semantic memories"
  on public.semantic_memories
  for select
  to authenticated
  using (
    health_profile_id is null
    and (select auth.uid()) = user_id
  );

drop policy if exists "Users can insert own semantic memories"
  on public.semantic_memories;
drop policy if exists "Users can insert own legacy semantic memories"
  on public.semantic_memories;
create policy "Users can insert own legacy semantic memories"
  on public.semantic_memories
  for insert
  to authenticated
  with check (
    health_profile_id is null
    and (select auth.uid()) = user_id
  );

drop policy if exists "Users can update own semantic memories"
  on public.semantic_memories;
drop policy if exists "Users can update own legacy semantic memories"
  on public.semantic_memories;
create policy "Users can update own legacy semantic memories"
  on public.semantic_memories
  for update
  to authenticated
  using (
    health_profile_id is null
    and (select auth.uid()) = user_id
  )
  with check (
    health_profile_id is null
    and (select auth.uid()) = user_id
  );

drop policy if exists "Users can delete own semantic memories"
  on public.semantic_memories;
drop policy if exists "Users can delete own legacy semantic memories"
  on public.semantic_memories;
create policy "Users can delete own legacy semantic memories"
  on public.semantic_memories
  for delete
  to authenticated
  using (
    health_profile_id is null
    and (select auth.uid()) = user_id
  );

drop policy if exists "Profile members can read semantic memories"
  on public.semantic_memories;
create policy "Profile members can read semantic memories"
  on public.semantic_memories
  for select
  to authenticated
  using (
    health_profile_id is not null
    and exists (
      select 1
      from public.health_profile_access hpa
      where hpa.health_profile_id = semantic_memories.health_profile_id
        and hpa.user_id = (select auth.uid())
        and hpa.status = 'active'
    )
  );

drop policy if exists "Profile writers can insert semantic memories"
  on public.semantic_memories;
create policy "Profile writers can insert semantic memories"
  on public.semantic_memories
  for insert
  to authenticated
  with check (
    health_profile_id is not null
    and exists (
      select 1
      from public.health_profile_access hpa
      where hpa.health_profile_id = semantic_memories.health_profile_id
        and hpa.user_id = (select auth.uid())
        and hpa.status = 'active'
        and hpa.role in ('owner', 'editor')
    )
  );

drop policy if exists "Profile writers can update semantic memories"
  on public.semantic_memories;
create policy "Profile writers can update semantic memories"
  on public.semantic_memories
  for update
  to authenticated
  using (
    health_profile_id is not null
    and exists (
      select 1
      from public.health_profile_access hpa
      where hpa.health_profile_id = semantic_memories.health_profile_id
        and hpa.user_id = (select auth.uid())
        and hpa.status = 'active'
        and hpa.role in ('owner', 'editor')
    )
  )
  with check (
    health_profile_id is not null
    and exists (
      select 1
      from public.health_profile_access hpa
      where hpa.health_profile_id = semantic_memories.health_profile_id
        and hpa.user_id = (select auth.uid())
        and hpa.status = 'active'
        and hpa.role in ('owner', 'editor')
    )
  );

drop policy if exists "Profile writers can delete semantic memories"
  on public.semantic_memories;
create policy "Profile writers can delete semantic memories"
  on public.semantic_memories
  for delete
  to authenticated
  using (
    health_profile_id is not null
    and exists (
      select 1
      from public.health_profile_access hpa
      where hpa.health_profile_id = semantic_memories.health_profile_id
        and hpa.user_id = (select auth.uid())
        and hpa.status = 'active'
        and hpa.role in ('owner', 'editor')
    )
  );

drop function if exists public.match_semantic_memories(extensions.vector(1536), int, float);
drop function if exists public.match_semantic_memories_for_user(uuid, extensions.vector(1536), int, float);
drop function if exists public.match_semantic_memories_for_health_profile(uuid, extensions.vector, int, float);

create or replace function public.match_semantic_memories(
  query_embedding extensions.vector(1536),
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
  memory_kind text,
  confidence numeric,
  provenance jsonb,
  is_pinned boolean,
  similarity float
)
language sql
stable
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
    semantic_memories.memory_kind,
    semantic_memories.confidence,
    semantic_memories.provenance,
    semantic_memories.is_pinned,
    1 - (semantic_memories.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.semantic_memories
  where semantic_memories.user_id = auth.uid()
    and semantic_memories.health_profile_id is null
    and semantic_memories.superseded_at is null
    and (semantic_memories.expires_at is null or semantic_memories.expires_at > now())
    and 1 - (semantic_memories.embedding operator(extensions.<=>) query_embedding) >= match_threshold
  order by
    semantic_memories.is_pinned desc,
    (1 - (semantic_memories.embedding operator(extensions.<=>) query_embedding)) desc,
    semantic_memories.importance desc,
    semantic_memories.created_at desc
  limit least(greatest(match_count, 1), 24);
$$;

revoke execute on function public.match_semantic_memories(extensions.vector(1536), int, float)
  from public, anon;
grant execute on function public.match_semantic_memories(extensions.vector(1536), int, float)
  to authenticated, service_role;

create or replace function public.match_semantic_memories_for_user(
  target_user_id uuid,
  query_embedding extensions.vector(1536),
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
  memory_kind text,
  confidence numeric,
  provenance jsonb,
  is_pinned boolean,
  similarity float
)
language sql
stable
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
    semantic_memories.memory_kind,
    semantic_memories.confidence,
    semantic_memories.provenance,
    semantic_memories.is_pinned,
    1 - (semantic_memories.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.semantic_memories
  where semantic_memories.user_id = target_user_id
    and (
      target_user_id = (select auth.uid())
      or current_setting('request.jwt.claim.role', true) = 'service_role'
    )
    and semantic_memories.health_profile_id is null
    and semantic_memories.superseded_at is null
    and (semantic_memories.expires_at is null or semantic_memories.expires_at > now())
    and 1 - (semantic_memories.embedding operator(extensions.<=>) query_embedding) >= match_threshold
  order by
    semantic_memories.is_pinned desc,
    (1 - (semantic_memories.embedding operator(extensions.<=>) query_embedding)) desc,
    semantic_memories.importance desc,
    semantic_memories.created_at desc
  limit least(greatest(match_count, 1), 24);
$$;

revoke execute on function public.match_semantic_memories_for_user(uuid, extensions.vector(1536), int, float)
  from public, anon, authenticated;
grant execute on function public.match_semantic_memories_for_user(uuid, extensions.vector(1536), int, float)
  to service_role;

create or replace function public.match_semantic_memories_for_health_profile(
  target_health_profile_id uuid,
  query_embedding extensions.vector(1536),
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
  memory_kind text,
  confidence numeric,
  provenance jsonb,
  is_pinned boolean,
  similarity float
)
language sql
stable
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
    semantic_memories.memory_kind,
    semantic_memories.confidence,
    semantic_memories.provenance,
    semantic_memories.is_pinned,
    1 - (semantic_memories.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.semantic_memories
  where semantic_memories.health_profile_id = target_health_profile_id
    and (
      current_setting('request.jwt.claim.role', true) = 'service_role'
      or exists (
        select 1
        from public.health_profile_access hpa
        where hpa.health_profile_id = target_health_profile_id
          and hpa.user_id = (select auth.uid())
          and hpa.status = 'active'
      )
    )
    and semantic_memories.superseded_at is null
    and (semantic_memories.expires_at is null or semantic_memories.expires_at > now())
    and 1 - (semantic_memories.embedding operator(extensions.<=>) query_embedding) >= match_threshold
  order by
    semantic_memories.is_pinned desc,
    (1 - (semantic_memories.embedding operator(extensions.<=>) query_embedding)) desc,
    semantic_memories.importance desc,
    semantic_memories.created_at desc
  limit least(greatest(match_count, 1), 24);
$$;

revoke execute on function public.match_semantic_memories_for_health_profile(uuid, extensions.vector(1536), int, float)
  from public, anon, authenticated;
grant execute on function public.match_semantic_memories_for_health_profile(uuid, extensions.vector(1536), int, float)
  to service_role;

notify pgrst, 'reload schema';
