create or replace function public.send_submission_to_moderation(_submission_id uuid)
returns public.moderation_cases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_submission public.submissions%rowtype;
  v_assignment public.assignments%rowtype;
  v_grade public.grades%rowtype;
  v_case public.moderation_cases%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_submission
  from public.submissions
  where id = _submission_id;

  if not found then
    raise exception 'Submission not found';
  end if;

  select *
  into v_assignment
  from public.assignments
  where id = v_submission.assignment_id;

  if not found then
    raise exception 'Assignment not found';
  end if;

  if v_assignment.lecturer_id <> v_user_id then
    raise exception 'Only the assignment owner can send a submission to moderation';
  end if;

  if not private.same_institution(v_assignment.institution_id) then
    raise exception 'Institution mismatch';
  end if;

  select *
  into v_grade
  from public.grades
  where submission_id = _submission_id
  order by created_at desc
  limit 1;

  if not found then
    raise exception 'Grade not found';
  end if;

  if v_grade.lecturer_score is null then
    raise exception 'Save a lecturer score before sending to moderation';
  end if;

  insert into public.moderation_cases (
    submission_id,
    assignment_id,
    grade_id,
    lecturer_id,
    first_marker_id,
    moderator_id,
    status,
    trigger_flags,
    trigger_summary,
    confidence_score,
    integrity_risk_score,
    ai_score_snapshot,
    first_marker_score,
    moderator_score,
    final_agreed_score,
    final_agreed_feedback,
    moderated_at,
    approved_at
  ) values (
    _submission_id,
    v_submission.assignment_id,
    v_grade.id,
    v_user_id,
    v_user_id,
    null,
    'moderation_pending',
    array[]::text[],
    'Lecturer requested moderation handoff.',
    v_grade.grading_confidence,
    null,
    v_grade.ai_score,
    v_grade.lecturer_score,
    null,
    null,
    null,
    null,
    null
  )
  on conflict (submission_id) do update set
    assignment_id = excluded.assignment_id,
    grade_id = excluded.grade_id,
    lecturer_id = excluded.lecturer_id,
    first_marker_id = excluded.first_marker_id,
    status = excluded.status,
    trigger_flags = excluded.trigger_flags,
    trigger_summary = excluded.trigger_summary,
    confidence_score = excluded.confidence_score,
    integrity_risk_score = excluded.integrity_risk_score,
    ai_score_snapshot = excluded.ai_score_snapshot,
    first_marker_score = excluded.first_marker_score,
    moderator_id = coalesce(moderation_cases.moderator_id, excluded.moderator_id),
    moderator_score = coalesce(moderation_cases.moderator_score, excluded.moderator_score),
    final_agreed_score = coalesce(moderation_cases.final_agreed_score, excluded.final_agreed_score),
    final_agreed_feedback = coalesce(moderation_cases.final_agreed_feedback, excluded.final_agreed_feedback),
    moderated_at = moderation_cases.moderated_at,
    approved_at = moderation_cases.approved_at
  returning * into v_case;

  update public.submissions
  set status = 'moderation_pending'
  where id = _submission_id;

  return v_case;
end;
$$;

grant execute on function public.send_submission_to_moderation(uuid) to authenticated;
