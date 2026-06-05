create table if not exists public.lms_connections (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  provider text not null,
  base_url text not null,
  access_token_secret_name text,
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, provider)
);

create table if not exists public.lms_provider_tokens (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  provider text not null,
  encrypted_token text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, provider)
);

create table if not exists public.lms_courses (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  provider text not null,
  external_id text not null,
  code text,
  title text not null,
  term text,
  updated_at timestamptz not null default now(),
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (institution_id, provider, external_id)
);

create table if not exists public.lms_assignments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  provider text not null,
  external_id text not null,
  course_external_id text not null,
  title text not null,
  due_at timestamptz,
  available_from timestamptz,
  available_until timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, provider, external_id)
);

create table if not exists public.lms_submissions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  provider text not null,
  external_id text not null,
  assignment_external_id text not null,
  student_external_id text not null,
  student_email text,
  student_name text,
  submitted_at timestamptz,
  status text not null default 'unknown',
  source_url text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, provider, external_id)
);

create table if not exists public.lms_grades (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  provider text not null,
  external_id text not null,
  submission_external_id text not null,
  score numeric,
  graded_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, provider, external_id)
);

create table if not exists public.lms_timing_events (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  provider text not null,
  external_id text not null,
  course_external_id text not null,
  submission_external_id text not null,
  event_type text not null,
  occurred_at timestamptz not null,
  source text not null,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (institution_id, provider, external_id)
);

create table if not exists public.lms_engagement_events (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  provider text not null,
  external_id text not null,
  course_external_id text not null,
  student_external_id text not null,
  event_type text not null,
  occurred_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (institution_id, provider, external_id)
);

create table if not exists public.lms_sync_cursors (
  institution_id uuid not null references public.institutions(id) on delete cascade,
  provider text not null,
  scope_key text not null,
  cursor_state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (institution_id, provider, scope_key)
);

create table if not exists public.lms_sync_runs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  provider text not null,
  sync_mode text not null,
  course_external_id text,
  assignment_external_id text,
  status text not null,
  summary jsonb not null default '{}'::jsonb,
  warnings text[] not null default '{}'::text[],
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lms_audit_log (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  provider text not null,
  entity_type text not null,
  entity_external_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lms_courses_lookup_idx
  on public.lms_courses (institution_id, provider, external_id);

create index if not exists lms_assignments_lookup_idx
  on public.lms_assignments (institution_id, provider, external_id);

create index if not exists lms_submissions_lookup_idx
  on public.lms_submissions (institution_id, provider, external_id);

create index if not exists lms_grades_lookup_idx
  on public.lms_grades (institution_id, provider, external_id);

create index if not exists lms_timing_events_lookup_idx
  on public.lms_timing_events (institution_id, provider, external_id);

create index if not exists lms_engagement_events_lookup_idx
  on public.lms_engagement_events (institution_id, provider, external_id);
