alter table public.student_risk_outcomes
  add column if not exists source_grade_id uuid references public.grades(id) on delete set null,
  add column if not exists source_submission_id uuid references public.submissions(id) on delete set null;

create unique index if not exists idx_student_risk_outcomes_source_grade_id
  on public.student_risk_outcomes (source_grade_id)
  where source_grade_id is not null;

create index if not exists idx_student_risk_outcomes_source_submission_id
  on public.student_risk_outcomes (source_submission_id);

alter table public.student_risk_outcomes
  drop constraint if exists student_risk_outcomes_grade_traceability;

alter table public.student_risk_outcomes
  add constraint student_risk_outcomes_grade_traceability
  check (outcome_source <> 'grade' or source_grade_id is not null);
