create table if not exists public.integrity_findings (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (
    provider in ('internal_text_similarity', 'llm_legacy', 'moss', 'external_provider')
  ),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  compared_submission_id uuid null references public.submissions(id) on delete set null,
  similarity_score numeric(5,2) not null default 0 check (similarity_score >= 0 and similarity_score <= 100),
  severity text not null check (severity in ('low', 'medium', 'high')),
  evidence_summary text not null,
  matched_phrases jsonb not null default '[]'::jsonb,
  raw_metadata jsonb not null default '{}'::jsonb,
  analysis_limited boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_integrity_findings_assignment_id
  on public.integrity_findings (assignment_id);

create index if not exists idx_integrity_findings_submission_id
  on public.integrity_findings (submission_id);

create index if not exists idx_integrity_findings_provider
  on public.integrity_findings (provider);

create index if not exists idx_integrity_findings_created_at
  on public.integrity_findings (created_at desc);

alter table public.integrity_findings enable row level security;

grant select on public.integrity_findings to authenticated;
grant insert on public.integrity_findings to service_role;

create policy "Authenticated users cannot insert integrity findings"
on public.integrity_findings
for insert
to authenticated
with check (false);

create policy "Lecturers can view integrity findings for own assignments"
on public.integrity_findings
for select
to authenticated
using (
  exists (
    select 1
    from public.assignments a
    where a.id = integrity_findings.assignment_id
      and a.lecturer_id = auth.uid()
  )
);

create policy "Admins can view all integrity findings"
on public.integrity_findings
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);
