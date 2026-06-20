-- Signal: Gmail Intelligence Platform schema
-- EMBED_DIM = 1024 (nvidia/nv-embedqa-e5-v5)

create extension if not exists vector;

create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text,
  avatar_url text,
  created_at timestamptz default now()
);

create table gmail_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  gmail_address text not null,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  token_expiry timestamptz not null,
  scopes text not null,
  last_history_id text,
  last_full_sync_at timestamptz,
  sync_status text default 'idle',
  created_at timestamptz default now(),
  unique (user_id)
);

create table threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  gmail_thread_id text not null,
  subject text,
  participant_emails text[],
  message_count int default 0,
  category text,
  thread_summary text,
  last_message_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, gmail_thread_id)
);

create table emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  thread_id uuid references threads(id) on delete cascade,
  gmail_message_id text not null,
  from_email text,
  from_name text,
  to_emails text[],
  subject text,
  snippet text,
  body_text text,
  body_html text,
  headers jsonb,
  category text,
  category_confidence numeric,
  summary text,
  is_unread boolean default true,
  is_sent boolean default false,
  is_inbox boolean default true,
  received_at timestamptz,
  created_at timestamptz default now(),
  unique (user_id, gmail_message_id)
);

create table email_chunks (
  id uuid primary key default gen_random_uuid(),
  email_id uuid references emails(id) on delete cascade,
  thread_id uuid references threads(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  chunk_index int not null,
  chunk_text text not null,
  embedding vector(1024),
  created_at timestamptz default now()
);

create table chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references chat_sessions(id) on delete cascade,
  role text not null,
  content text not null,
  citations jsonb,
  created_at timestamptz default now()
);

create table newsletter_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  source_email_id uuid references emails(id) on delete cascade,
  title text,
  snippet text,
  url text,
  published_at timestamptz,
  embedding vector(1024),
  cluster_id uuid,
  created_at timestamptz default now()
);

create table sync_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  job_type text not null,
  status text default 'pending',
  cursor jsonb,
  processed_count int default 0,
  total_estimate int,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create index emails_user_thread_idx on emails (user_id, thread_id);
create index emails_user_received_idx on emails (user_id, received_at desc);
create index emails_user_category_idx on emails (user_id, category);
create index threads_user_last_message_idx on threads (user_id, last_message_at desc);
create index email_chunks_user_idx on email_chunks (user_id);
create index email_chunks_embedding_idx on email_chunks using hnsw (embedding vector_cosine_ops);
create index newsletter_items_embedding_idx on newsletter_items using hnsw (embedding vector_cosine_ops);

alter table users enable row level security;
alter table gmail_accounts enable row level security;
alter table threads enable row level security;
alter table emails enable row level security;
alter table email_chunks enable row level security;
alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;
alter table newsletter_items enable row level security;
alter table sync_jobs enable row level security;

-- Server uses service role (bypasses RLS). Deny anon/authenticated direct access.
create policy "deny_anon" on users for all using (false);
create policy "deny_anon" on gmail_accounts for all using (false);
create policy "deny_anon" on threads for all using (false);
create policy "deny_anon" on emails for all using (false);
create policy "deny_anon" on email_chunks for all using (false);
create policy "deny_anon" on chat_sessions for all using (false);
create policy "deny_anon" on chat_messages for all using (false);
create policy "deny_anon" on newsletter_items for all using (false);
create policy "deny_anon" on sync_jobs for all using (false);

-- RPC for vector similarity search scoped to user
create or replace function match_email_chunks(
  query_embedding vector(1024),
  match_user_id uuid,
  match_count int default 10
)
returns table (
  id uuid,
  email_id uuid,
  thread_id uuid,
  chunk_text text,
  chunk_index int,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    ec.id,
    ec.email_id,
    ec.thread_id,
    ec.chunk_text,
    ec.chunk_index,
    1 - (ec.embedding <=> query_embedding) as similarity
  from email_chunks ec
  where ec.user_id = match_user_id
    and ec.embedding is not null
  order by ec.embedding <=> query_embedding
  limit match_count;
end;
$$;
