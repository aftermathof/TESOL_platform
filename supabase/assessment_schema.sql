-- Quiz and teaching plan assessment schema

create type public.quiz_question_type as enum ('single', 'multiple', 'blank', 'short');

create table if not exists public.quiz_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  source_file text,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_bank (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.quiz_sources(id) on delete set null,
  title text not null,
  duration_minutes integer,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quiz_bank(id) on delete cascade,
  question_type public.quiz_question_type not null,
  prompt text not null,
  options jsonb,
  answer jsonb,
  explanation text,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_submissions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quiz_bank(id) on delete cascade,
  user_id uuid not null,
  score numeric(5,2),
  total_items integer,
  ai_overall_score numeric(5,2),
  ai_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quiz_submissions_user_idx unique (quiz_id, user_id, created_at)
);

create table if not exists public.quiz_submission_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.quiz_submissions(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  response jsonb not null,
  is_objective boolean not null default true,
  is_correct boolean,
  ai_score numeric(5,2),
  ai_feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  manual_override boolean default false,
  manual_feedback text
);

create table if not exists public.teaching_plan_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  plan_content text not null,
  status text not null default 'submitted',
  ai_score numeric(5,2),
  ai_feedback text,
  manual_score numeric(5,2),
  manual_feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teaching_plan_history (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.teaching_plan_submissions(id) on delete cascade,
  reviewer_id uuid,
  stage text not null,
  score numeric(5,2),
  feedback text,
  created_at timestamptz not null default now()
);

create index if not exists quiz_questions_quiz_id_idx on public.quiz_questions (quiz_id);
create index if not exists quiz_submissions_user_idx2 on public.quiz_submissions (user_id, created_at desc);
create index if not exists quiz_submission_answers_submission_idx on public.quiz_submission_answers (submission_id);
create index if not exists teaching_plan_submissions_user_idx on public.teaching_plan_submissions (user_id, created_at desc);

alter table public.quiz_submissions
  enable row level security;

alter table public.quiz_submission_answers
  enable row level security;

alter table public.teaching_plan_submissions
  enable row level security;

alter table public.teaching_plan_history
  enable row level security;

create policy "Users can manage own quiz submissions"
  on public.quiz_submissions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own quiz answers"
  on public.quiz_submission_answers
  for all
  using (
    exists (
      select 1 from public.quiz_submissions qs
      where qs.id = submission_id
        and qs.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.quiz_submissions qs
      where qs.id = submission_id
        and qs.user_id = auth.uid()
    )
  );

create policy "Users can manage own teaching plan submissions"
  on public.teaching_plan_submissions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can view their teaching plan history"
  on public.teaching_plan_history
  for select
  using (
    exists (
      select 1 from public.teaching_plan_submissions tps
      where tps.id = submission_id
        and tps.user_id = auth.uid()
    )
  );
