create or replace function private.submission_identity_is_unchanged(
  p_submission_id uuid,
  p_assignment_id text,
  p_institution_id uuid,
  p_student_id uuid,
  p_student_name text,
  p_student_email text,
  p_file_url text,
  p_file_name text,
  p_file_type text,
  p_uploaded_by uuid,
  p_submitted_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.submissions original
    where original.id = p_submission_id
      and original.assignment_id = p_assignment_id
      and original.institution_id = p_institution_id
      and coalesce(original.student_id, '00000000-0000-0000-0000-000000000000'::uuid) =
        coalesce(p_student_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and coalesce(original.student_name, ''::text) = coalesce(p_student_name, ''::text)
      and coalesce(original.student_email, ''::text) = coalesce(p_student_email, ''::text)
      and coalesce(original.file_url, ''::text) = coalesce(p_file_url, ''::text)
      and coalesce(original.file_name, ''::text) = coalesce(p_file_name, ''::text)
      and coalesce(original.file_type, ''::text) = coalesce(p_file_type, ''::text)
      and coalesce(original.uploaded_by, '00000000-0000-0000-0000-000000000000'::uuid) =
        coalesce(p_uploaded_by, '00000000-0000-0000-0000-000000000000'::uuid)
      and original.submitted_at = p_submitted_at
  );
$$;

drop policy if exists "Lecturers can update submissions for own assignments" on public.submissions;

create policy "Lecturers can update submissions for own assignments"
on public.submissions
for update
to authenticated
using (
  private.same_institution(institution_id)
  and exists (
    select 1
    from public.assignments a
    where a.id::text = public.submissions.assignment_id
      and a.lecturer_id = (select auth.uid())
      and a.institution_id = public.submissions.institution_id
  )
)
with check (
  private.same_institution(institution_id)
  and exists (
    select 1
    from public.assignments a
    where a.id::text = public.submissions.assignment_id
      and a.lecturer_id = (select auth.uid())
      and a.institution_id = public.submissions.institution_id
  )
  and private.submission_identity_is_unchanged(
    public.submissions.id,
    public.submissions.assignment_id,
    public.submissions.institution_id,
    public.submissions.student_id,
    public.submissions.student_name,
    public.submissions.student_email,
    public.submissions.file_url,
    public.submissions.file_name,
    public.submissions.file_type,
    public.submissions.uploaded_by,
    public.submissions.submitted_at
  )
);
