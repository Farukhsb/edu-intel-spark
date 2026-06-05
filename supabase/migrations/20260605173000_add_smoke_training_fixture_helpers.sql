create or replace function public.clear_smoke_training_fixture()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  delete from auth.identities
  where user_id = '9f1afdc3-0f58-4c0b-89cb-c2f65c6f4c01';

  delete from auth.users
  where id = '9f1afdc3-0f58-4c0b-89cb-c2f65c6f4c01';
end;
$$;

create or replace function public.seed_smoke_training_fixture()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    invited_at,
    confirmation_token,
    confirmation_sent_at,
    recovery_token,
    recovery_sent_at,
    email_change_token_new,
    email_change,
    email_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    phone_change,
    phone_change_token,
    phone_change_sent_at,
    email_change_token_current,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at,
    is_sso_user,
    deleted_at,
    is_anonymous
  )
  values (
    '9f1afdc3-0f58-4c0b-89cb-c2f65c6f4c01',
    'authenticated',
    'authenticated',
    'smoke.student.one@edu-intel.test',
    null,
    now(),
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object(
      'full_name', 'Smoke Student One',
      'role', 'student',
      'institution_slug', 'smoke-default-20260602',
      'department_name', 'Smoke Studies',
      'cohort_id', 'smoke-cohort'
    ),
    false,
    now(),
    now(),
    '',
    null,
    '',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    false,
    null,
    false
  )
  on conflict (id) do update
  set
    aud = excluded.aud,
    role = excluded.role,
    email = excluded.email,
    email_confirmed_at = excluded.email_confirmed_at,
    last_sign_in_at = excluded.last_sign_in_at,
    raw_app_meta_data = excluded.raw_app_meta_data,
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = excluded.updated_at,
    is_sso_user = excluded.is_sso_user,
    is_anonymous = excluded.is_anonymous;

  insert into auth.identities (
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    '5ae4e5b4-1f1a-4bd5-a9e7-3db61d04a5c2',
    'smoke.student.one@edu-intel.test',
    '9f1afdc3-0f58-4c0b-89cb-c2f65c6f4c01',
    jsonb_build_object(
      'email', 'smoke.student.one@edu-intel.test',
      'sub', '9f1afdc3-0f58-4c0b-89cb-c2f65c6f4c01',
      'full_name', 'Smoke Student One'
    ),
    'email',
    now(),
    now(),
    now()
  )
  on conflict (id) do update
  set
    provider_id = excluded.provider_id,
    user_id = excluded.user_id,
    identity_data = excluded.identity_data,
    provider = excluded.provider,
    last_sign_in_at = excluded.last_sign_in_at,
    updated_at = excluded.updated_at;

  insert into public.student_risk_snapshots (
    id,
    student_id,
    institution_id,
    snapshot_date,
    feature_version,
    features
  )
  values (
    '7a82a68d-3a0d-4d55-9a8f-0de0a8f0d4cc',
    '9f1afdc3-0f58-4c0b-89cb-c2f65c6f4c01',
    'b7fc80e2-5802-4d32-a5e2-998cc7d7f149',
    current_date,
    'smoke-v1',
    jsonb_build_object(
      'scoreCount', 3,
      'average', 48,
      'last', 44,
      'minimum', 41,
      'maximum', 56,
      'slope', -1.8,
      'predictedNext', 42,
      'stdDev', 5.9,
      'recent3Avg', 45,
      'earlyAvg', 52,
      'firstLastDelta', -8,
      'recentDelta', -4,
      'below50Ratio', 0.6667,
      'below40Ratio', 0.0
    )
  )
  on conflict (student_id, snapshot_date, feature_version) do update
  set features = excluded.features;

  with snapshot_seed as (
    select id
    from public.student_risk_snapshots
    where student_id = '9f1afdc3-0f58-4c0b-89cb-c2f65c6f4c01'
      and snapshot_date = current_date
      and feature_version = 'smoke-v1'
    limit 1
  )
  insert into public.student_risk_predictions (
    id,
    snapshot_id,
    student_id,
    institution_id,
    prediction_date,
    model_version,
    risk_score,
    risk_band,
    reason_codes,
    explanation,
    details
  )
  select
    '5cce4c0b-0f7c-43d0-a1a2-3ff5f21d9bb4',
    snapshot_seed.id,
    '9f1afdc3-0f58-4c0b-89cb-c2f65c6f4c01',
    'b7fc80e2-5802-4d32-a5e2-998cc7d7f149',
    current_date,
    'smoke-train-v1',
    0.78,
    'high',
    array['low_average', 'negative_trend', 'missed_activity'],
    'Smoke-test prediction used to seed the weekly retraining pipeline.',
    jsonb_build_object(
      'model_feature_vector', jsonb_build_object(
        'scoreCount', 3,
        'average', 48,
        'last', 44,
        'minimum', 41,
        'maximum', 56,
        'slope', -1.8,
        'predictedNext', 42,
        'stdDev', 5.9,
        'recent3Avg', 45,
        'earlyAvg', 52,
        'firstLastDelta', -8,
        'recentDelta', -4,
        'below50Ratio', 0.6667,
        'below40Ratio', 0.0
      ),
      'model_confidence', 0.87,
      'model_risk_score', 0.78,
      'academic_risk_score', 0.81,
      'engagement_event_count', 2,
      'engagement_last_event_age_days', 10,
      'non_submission_total_assignments', 3,
      'non_submission_submitted_assignments', 1,
      'non_submission_late_submissions', 1,
      'composite_component_scores', jsonb_build_object(
        'academic', 0.81,
        'engagement', 0.69,
        'nonSubmission', 0.88
      )
    )
  from snapshot_seed
  on conflict (snapshot_id, model_version) do update
  set
    risk_score = excluded.risk_score,
    risk_band = excluded.risk_band,
    reason_codes = excluded.reason_codes,
    explanation = excluded.explanation,
    details = excluded.details;

  insert into public.student_risk_outcomes (
    id,
    student_id,
    institution_id,
    prediction_id,
    snapshot_id,
    outcome_date,
    label_window_days,
    label_value,
    outcome_status,
    outcome_source,
    notes
  )
  select
    'a4e3a2bf-2a7a-4b50-986d-350fd091d0ea',
    '9f1afdc3-0f58-4c0b-89cb-c2f65c6f4c01',
    'b7fc80e2-5802-4d32-a5e2-998cc7d7f149',
    pred.id,
    pred.snapshot_id,
    current_date,
    30,
    'high',
    'at_risk',
    'manual',
    'Smoke-test outcome used to seed the weekly retraining pipeline.'
  from (
    select
      p.id,
      p.snapshot_id
    from public.student_risk_predictions p
    where p.student_id = '9f1afdc3-0f58-4c0b-89cb-c2f65c6f4c01'
      and p.model_version = 'smoke-train-v1'
    limit 1
  ) pred
  on conflict (student_id, outcome_date, label_window_days, outcome_source) do update
  set
    prediction_id = excluded.prediction_id,
    snapshot_id = excluded.snapshot_id,
    label_value = excluded.label_value,
    outcome_status = excluded.outcome_status,
    notes = excluded.notes;
end;
$$;

create or replace function public.refresh_smoke_training_fixture()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.clear_smoke_training_fixture();
  perform public.seed_smoke_training_fixture();
end;
$$;

grant execute on function public.clear_smoke_training_fixture() to service_role;
grant execute on function public.seed_smoke_training_fixture() to service_role;
grant execute on function public.refresh_smoke_training_fixture() to service_role;
