-- 学习模块与 OCR 缓存相关表结构
-- 在 Supabase SQL 编辑器中执行本文件，确保已启用扩展 pgcrypto (用于 gen_random_uuid)

create extension if not exists "pgcrypto";

create table if not exists public.learning_modules (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  title text not null,
  description text,
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

create table if not exists public.module_progress (
  module_id uuid not null references public.learning_modules(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  completed_at timestamptz not null default timezone('utc'::text, now()),
  primary key (module_id, user_id)
);

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
alter table public.module_progress enable row level security;
alter table public.learning_ocr_cache enable row level security;

create policy if not exists "learning_modules_read"
  on public.learning_modules
  for select
  using (auth.role() = 'authenticated');

create policy if not exists "module_sections_read"
  on public.module_sections
  for select
  using (auth.role() = 'authenticated');

create policy if not exists "module_progress_select"
  on public.module_progress
  for select
  using (auth.uid() = user_id);

create policy if not exists "module_progress_upsert"
  on public.module_progress
  for insert
  with check (auth.uid() = user_id);

create policy if not exists "ocr_cache_service_read"
  on public.learning_ocr_cache
  for select
  using (auth.role() = 'service_role');

create policy if not exists "ocr_cache_service_write"
  on public.learning_ocr_cache
  for insert
  with check (auth.role() = 'service_role');
