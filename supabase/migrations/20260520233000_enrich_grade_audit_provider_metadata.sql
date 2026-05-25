create or replace function public.log_grade_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    insert into public.grade_audit_log (
      submission_id,
      grade_id,
      changed_by,
      event_type,
      actor_role,
      new_values
    )
    values (
      new.submission_id,
      new.id,
      actor_id,
      'grade_created',
      case when private.is_lecturer() then 'lecturer' else 'system' end,
      jsonb_build_object(
        'ai_score', new.ai_score,
        'lecturer_score', new.lecturer_score,
        'final_score', new.final_score,
        'grading_confidence', new.grading_confidence,
        'ai_provider', coalesce(new.grading_metadata ->> 'ai_provider_name', new.grading_metadata -> 'ai_provider' ->> 'provider'),
        'ai_model', coalesce(new.grading_metadata ->> 'ai_model', new.grading_metadata -> 'ai_provider' ->> 'model'),
        'ai_mode', coalesce(new.grading_metadata ->> 'ai_mode', new.grading_metadata -> 'ai_provider' ->> 'mode'),
        'ai_fallback_used', coalesce(new.grading_metadata -> 'ai_fallback_used', new.grading_metadata -> 'ai_provider' -> 'fallbackUsed', 'false'::jsonb),
        'ai_latency_ms', coalesce(new.grading_metadata -> 'ai_latency_ms', new.grading_metadata -> 'ai_provider' -> 'latencyMs'),
        'ai_success', coalesce(new.grading_metadata -> 'ai_success', new.grading_metadata -> 'ai_provider' -> 'success', 'true'::jsonb),
        'ai_failure_type', coalesce(new.grading_metadata ->> 'ai_failure_type', new.grading_metadata -> 'ai_provider' ->> 'failureType'),
        'ai_attempts', coalesce(new.grading_metadata -> 'ai_attempts', new.grading_metadata -> 'ai_provider' -> 'attempts', '[]'::jsonb)
      )
    );

    return new;
  end if;

  if row(
    old.ai_score,
    old.lecturer_score,
    old.final_score,
    old.ai_feedback,
    old.lecturer_feedback,
    old.final_feedback,
    old.reviewed_by,
    old.reviewed_at
  ) is distinct from row(
    new.ai_score,
    new.lecturer_score,
    new.final_score,
    new.ai_feedback,
    new.lecturer_feedback,
    new.final_feedback,
    new.reviewed_by,
    new.reviewed_at
  ) then
    insert into public.grade_audit_log (
      submission_id,
      grade_id,
      changed_by,
      event_type,
      actor_role,
      previous_values,
      new_values
    )
    values (
      new.submission_id,
      new.id,
      actor_id,
      'grade_updated',
      case when private.is_lecturer() then 'lecturer' else 'system' end,
      jsonb_build_object(
        'ai_score', old.ai_score,
        'lecturer_score', old.lecturer_score,
        'final_score', old.final_score,
        'ai_feedback', old.ai_feedback,
        'lecturer_feedback', old.lecturer_feedback,
        'final_feedback', old.final_feedback,
        'reviewed_by', old.reviewed_by,
        'reviewed_at', old.reviewed_at,
        'ai_provider', coalesce(old.grading_metadata ->> 'ai_provider_name', old.grading_metadata -> 'ai_provider' ->> 'provider'),
        'ai_model', coalesce(old.grading_metadata ->> 'ai_model', old.grading_metadata -> 'ai_provider' ->> 'model'),
        'ai_mode', coalesce(old.grading_metadata ->> 'ai_mode', old.grading_metadata -> 'ai_provider' ->> 'mode'),
        'ai_fallback_used', coalesce(old.grading_metadata -> 'ai_fallback_used', old.grading_metadata -> 'ai_provider' -> 'fallbackUsed', 'false'::jsonb),
        'ai_latency_ms', coalesce(old.grading_metadata -> 'ai_latency_ms', old.grading_metadata -> 'ai_provider' -> 'latencyMs'),
        'ai_success', coalesce(old.grading_metadata -> 'ai_success', old.grading_metadata -> 'ai_provider' -> 'success', 'true'::jsonb),
        'ai_failure_type', coalesce(old.grading_metadata ->> 'ai_failure_type', old.grading_metadata -> 'ai_provider' ->> 'failureType'),
        'ai_attempts', coalesce(old.grading_metadata -> 'ai_attempts', old.grading_metadata -> 'ai_provider' -> 'attempts', '[]'::jsonb)
      ),
      jsonb_build_object(
        'ai_score', new.ai_score,
        'lecturer_score', new.lecturer_score,
        'final_score', new.final_score,
        'ai_feedback', new.ai_feedback,
        'lecturer_feedback', new.lecturer_feedback,
        'final_feedback', new.final_feedback,
        'reviewed_by', new.reviewed_by,
        'reviewed_at', new.reviewed_at,
        'ai_provider', coalesce(new.grading_metadata ->> 'ai_provider_name', new.grading_metadata -> 'ai_provider' ->> 'provider'),
        'ai_model', coalesce(new.grading_metadata ->> 'ai_model', new.grading_metadata -> 'ai_provider' ->> 'model'),
        'ai_mode', coalesce(new.grading_metadata ->> 'ai_mode', new.grading_metadata -> 'ai_provider' ->> 'mode'),
        'ai_fallback_used', coalesce(new.grading_metadata -> 'ai_fallback_used', new.grading_metadata -> 'ai_provider' -> 'fallbackUsed', 'false'::jsonb),
        'ai_latency_ms', coalesce(new.grading_metadata -> 'ai_latency_ms', new.grading_metadata -> 'ai_provider' -> 'latencyMs'),
        'ai_success', coalesce(new.grading_metadata -> 'ai_success', new.grading_metadata -> 'ai_provider' -> 'success', 'true'::jsonb),
        'ai_failure_type', coalesce(new.grading_metadata ->> 'ai_failure_type', new.grading_metadata -> 'ai_provider' ->> 'failureType'),
        'ai_attempts', coalesce(new.grading_metadata -> 'ai_attempts', new.grading_metadata -> 'ai_provider' -> 'attempts', '[]'::jsonb)
      )
    );
  end if;

  return new;
end;
$$;
