with ranked_duplicates as (
  select
    id,
    row_number() over (
      partition by provider, assignment_id, submission_id, compared_submission_id
      order by created_at desc, id desc
    ) as row_number_within_pair
  from public.integrity_findings
  where compared_submission_id is not null
)
delete from public.integrity_findings findings
using ranked_duplicates duplicates
where findings.id = duplicates.id
  and duplicates.row_number_within_pair > 1;

create unique index if not exists uq_integrity_findings_provider_assignment_submission_pair
  on public.integrity_findings (provider, assignment_id, submission_id, compared_submission_id);
