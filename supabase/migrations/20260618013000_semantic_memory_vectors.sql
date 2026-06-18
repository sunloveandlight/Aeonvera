-- Semantic/RAG memory foundation.
-- Stores private per-user memory chunks with pgvector embeddings for retrieval-augmented AI context.

create extension if not exists vector with schema extensions;

create table if not exists public.semantic_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null,
  source_id text,
  title text,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536) not null,
  importance numeric not null default 0.5 check (importance >= 0 and importance <= 1),
  occurred_at timestamptz,
  last_retrieved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.semantic_memories enable row level security;

grant select, insert, update, delete on public.semantic_memories to authenticated;
grant select, insert, update, delete on public.semantic_memories to service_role;

drop policy if exists "Users can read own semantic memories"
  on public.semantic_memories;
create policy "Users can read own semantic memories"
  on public.semantic_memories
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own semantic memories"
  on public.semantic_memories;
create policy "Users can insert own semantic memories"
  on public.semantic_memories
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own semantic memories"
  on public.semantic_memories;
create policy "Users can update own semantic memories"
  on public.semantic_memories
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own semantic memories"
  on public.semantic_memories;
create policy "Users can delete own semantic memories"
  on public.semantic_memories
  for delete
  to authenticated
  using (auth.uid() = user_id);

create index if not exists semantic_memories_user_created_idx
  on public.semantic_memories (user_id, created_at desc);

create index if not exists semantic_memories_user_source_idx
  on public.semantic_memories (user_id, source_type, source_id);

create index if not exists semantic_memories_metadata_idx
  on public.semantic_memories using gin (metadata);

create index if not exists semantic_memories_embedding_hnsw_idx
  on public.semantic_memories
  using hnsw (embedding vector_cosine_ops);

create or replace function public.match_semantic_memories(
  query_embedding vector(1536),
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
  where semantic_memories.user_id = auth.uid()
    and 1 - (semantic_memories.embedding <=> query_embedding) >= match_threshold
  order by
    (1 - (semantic_memories.embedding <=> query_embedding)) desc,
    semantic_memories.importance desc,
    semantic_memories.created_at desc
  limit least(greatest(match_count, 1), 24);
$$;

grant execute on function public.match_semantic_memories(vector(1536), int, float)
  to authenticated, service_role;

create or replace function public.match_semantic_memories_for_user(
  target_user_id uuid,
  query_embedding vector(1536),
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
  where semantic_memories.user_id = target_user_id
    and 1 - (semantic_memories.embedding <=> query_embedding) >= match_threshold
  order by
    (1 - (semantic_memories.embedding <=> query_embedding)) desc,
    semantic_memories.importance desc,
    semantic_memories.created_at desc
  limit least(greatest(match_count, 1), 24);
$$;

revoke execute on function public.match_semantic_memories_for_user(uuid, vector(1536), int, float)
  from anon, authenticated;
grant execute on function public.match_semantic_memories_for_user(uuid, vector(1536), int, float)
  to service_role;

notify pgrst, 'reload schema';
