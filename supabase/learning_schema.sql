-- 学习模块与 OCR 缓存相关表结构
-- 在 Supabase SQL 编辑器中执行本文件，确保已启用扩展 pgcrypto (用于 gen_random_uuid)

create extension if not exists "pgcrypto";

create table if not exists public.learning_modules (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  title text not null,
  order_index integer default 0,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists learning_modules_source_idx
  on public.learning_modules (source_key, order_index);

create table if not exists public.module_sections (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.learning_modules(id) on delete cascade,
  title text not null,
  summary text,
  order_index integer default 0,
  duration_minutes integer,
  content text not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists module_sections_module_idx
  on public.module_sections (module_id, order_index);

create table if not exists public.learning_documents (
  source_key text primary key,
  raw_text text,
  formatted_text text,
  formatted_modules jsonb,
  formatter_model text,
  formatter_used boolean default false,
  formatter_error text,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.module_progress (
  module_id uuid not null references public.learning_modules(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  completed_at timestamptz not null default timezone('utc'::text, now()),
  primary key (module_id, user_id)
);

create table if not exists public.module_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id uuid not null references public.learning_modules(id) on delete cascade,
  section_id uuid not null references public.module_sections(id) on delete cascade,
  start_index integer not null,
  end_index integer not null,
  color text not null default '#fff9b1',
  excerpt text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists module_highlights_section_idx
  on public.module_highlights (section_id, user_id);

create table if not exists public.module_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id uuid not null references public.learning_modules(id) on delete cascade,
  section_id uuid not null references public.module_sections(id) on delete cascade,
  start_index integer not null,
  end_index integer not null,
  note_text text not null,
  excerpt text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists module_notes_section_idx
  on public.module_notes (section_id, user_id, created_at);

create table if not exists public.learning_ocr_cache (
  cache_key text primary key,
  module_id text not null,
  file_url text not null,
  page_start integer,
  page_end integer,
  text text,
  confidence double precision,
  pages jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists learning_ocr_cache_module_idx
  on public.learning_ocr_cache (module_id);

-- 行级安全 & 策略

alter table public.learning_modules enable row level security;
alter table public.module_sections enable row level security;
alter table public.learning_documents enable row level security;
alter table public.module_progress enable row level security;
alter table public.learning_ocr_cache enable row level security;
alter table public.module_highlights enable row level security;
alter table public.module_notes enable row level security;

drop policy if exists "learning_modules_read" on public.learning_modules;
create policy "learning_modules_read"
  on public.learning_modules
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "module_sections_read" on public.module_sections;
create policy "module_sections_read"
  on public.module_sections
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "learning_documents_read" on public.learning_documents;
create policy "learning_documents_read"
  on public.learning_documents
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "learning_documents_service_upsert" on public.learning_documents;
create policy "learning_documents_service_upsert"
  on public.learning_documents
  for insert
  with check (auth.role() = 'service_role');

drop policy if exists "learning_documents_service_update" on public.learning_documents;
create policy "learning_documents_service_update"
  on public.learning_documents
  for update
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "module_progress_select" on public.module_progress;
create policy "module_progress_select"
  on public.module_progress
  for select
  using (auth.uid() = user_id);

drop policy if exists "module_progress_upsert" on public.module_progress;
create policy "module_progress_upsert"
  on public.module_progress
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "module_highlights_select" on public.module_highlights;
create policy "module_highlights_select"
  on public.module_highlights
  for select
  using (auth.uid() = user_id);

drop policy if exists "module_highlights_insert" on public.module_highlights;
create policy "module_highlights_insert"
  on public.module_highlights
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "module_highlights_update" on public.module_highlights;
create policy "module_highlights_update"
  on public.module_highlights
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "module_highlights_delete" on public.module_highlights;
create policy "module_highlights_delete"
  on public.module_highlights
  for delete
  using (auth.uid() = user_id);

drop policy if exists "module_notes_select" on public.module_notes;
create policy "module_notes_select"
  on public.module_notes
  for select
  using (auth.uid() = user_id);

drop policy if exists "module_notes_insert" on public.module_notes;
create policy "module_notes_insert"
  on public.module_notes
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "module_notes_update" on public.module_notes;
create policy "module_notes_update"
  on public.module_notes
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "module_notes_delete" on public.module_notes;
create policy "module_notes_delete"
  on public.module_notes
  for delete
  using (auth.uid() = user_id);

drop policy if exists "ocr_cache_service_read" on public.learning_ocr_cache;
create policy "ocr_cache_service_read"
  on public.learning_ocr_cache
  for select
  using (auth.role() = 'service_role');

drop policy if exists "ocr_cache_service_write" on public.learning_ocr_cache;
create policy "ocr_cache_service_write"
  on public.learning_ocr_cache
  for insert
  with check (auth.role() = 'service_role');
