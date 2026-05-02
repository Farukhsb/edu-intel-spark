grant select, insert, update on public.academic_integrity_reviews to service_role;
grant select, insert, update on public.student_writing_profiles to service_role;

with ranked_duplicates as (
  select
    id,
    row_number() over (
      partition by provider, assignment_id, submission_id, compared_submission_id
      order by created_at desc, id desc
    ) as row_number_within_pair
  from public.integrity_findings
  where provider = 'internal_text_similarity'
    and compared_submission_id is not null
)
delete from public.integrity_findings findings
using ranked_duplicates duplicates
where findings.id = duplicates.id
  and duplicates.row_number_within_pair > 1;
