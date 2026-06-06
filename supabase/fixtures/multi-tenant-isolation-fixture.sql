insert into public.institutions (id, name, slug, status)
values
  ('11111111-1111-4111-8111-111111111111', 'Isolation Institution A', 'isolation-alpha', 'active'),
  ('22222222-2222-4222-8222-222222222222', 'Isolation Institution B', 'isolation-beta', 'active')
on conflict (id) do update
set
  name = excluded.name,
  slug = excluded.slug,
  status = excluded.status;

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
  '33333333-3333-4333-8333-333333333333',
  'authenticated',
  'authenticated',
  'isolation.student.a@edu-intel.test',
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
    'full_name', 'Isolation Student A',
    'role', 'student',
    'institution_slug', 'isolation-alpha',
    'department_name', 'Isolation Studies',
    'cohort_id', 'isolation-cohort-a'
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
), (
  '44444444-4444-4444-8444-444444444444',
  'authenticated',
  'authenticated',
  'isolation.student.b@edu-intel.test',
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
    'full_name', 'Isolation Student B',
    'role', 'student',
    'institution_slug', 'isolation-beta',
    'department_name', 'Isolation Studies',
    'cohort_id', 'isolation-cohort-b'
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
  '55555555-5555-4555-8555-555555555555',
  'isolation.student.a@edu-intel.test',
  '33333333-3333-4333-8333-333333333333',
  jsonb_build_object(
    'email', 'isolation.student.a@edu-intel.test',
    'sub', '33333333-3333-4333-8333-333333333333',
    'full_name', 'Isolation Student A'
  ),
  'email',
  now(),
  now(),
  now()
), (
  '66666666-6666-4666-8666-666666666666',
  'isolation.student.b@edu-intel.test',
  '44444444-4444-4444-8444-444444444444',
  jsonb_build_object(
    'email', 'isolation.student.b@edu-intel.test',
    'sub', '44444444-4444-4444-8444-444444444444',
    'full_name', 'Isolation Student B'
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

insert into public.profiles (
  id,
  full_name,
  email,
  role,
  cohort_id,
  department_name,
  department_id,
  institution_id
)
values (
  '33333333-3333-4333-8333-333333333333',
  'Isolation Student A',
  'isolation.student.a@edu-intel.test',
  'student',
  'isolation-cohort-a',
  'Isolation Studies',
  'Isolation Studies',
  '11111111-1111-4111-8111-111111111111'
), (
  '44444444-4444-4444-8444-444444444444',
  'Isolation Student B',
  'isolation.student.b@edu-intel.test',
  'student',
  'isolation-cohort-b',
  'Isolation Studies',
  'Isolation Studies',
  '22222222-2222-4222-8222-222222222222'
)
on conflict (id) do update
set
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role,
  cohort_id = excluded.cohort_id,
  department_name = excluded.department_name,
  department_id = excluded.department_id,
  institution_id = excluded.institution_id;

insert into public.user_roles (user_id, role, institution_id)
values
  ('33333333-3333-4333-8333-333333333333', 'student', '11111111-1111-4111-8111-111111111111'),
  ('44444444-4444-4444-8444-444444444444', 'student', '22222222-2222-4222-8222-222222222222')
on conflict (user_id, role) do update
set institution_id = excluded.institution_id;

insert into public.student_risk_snapshots (
  id,
  student_id,
  institution_id,
  snapshot_date,
  feature_version,
  features
)
values (
  '77777777-7777-4777-8777-777777777777',
  '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111',
  current_date,
  'isolation-v1',
  jsonb_build_object(
    'scoreCount', 2,
    'average', 54,
    'last', 52,
    'minimum', 51,
    'maximum', 57,
    'slope', 0.5,
    'predictedNext', 55,
    'stdDev', 2.1,
    'recent3Avg', 53,
    'earlyAvg', 54,
    'firstLastDelta', -2,
    'recentDelta', 1,
    'below50Ratio', 0.0,
    'below40Ratio', 0.0
  )
), (
  '88888888-8888-4888-8888-888888888888',
  '44444444-4444-4444-8444-444444444444',
  '22222222-2222-4222-8222-222222222222',
  current_date,
  'isolation-v1',
  jsonb_build_object(
    'scoreCount', 2,
    'average', 39,
    'last', 36,
    'minimum', 34,
    'maximum', 43,
    'slope', -1.5,
    'predictedNext', 35,
    'stdDev', 3.7,
    'recent3Avg', 37,
    'earlyAvg', 42,
    'firstLastDelta', -6,
    'recentDelta', -3,
    'below50Ratio', 1.0,
    'below40Ratio', 0.5
  )
)
on conflict (student_id, snapshot_date, feature_version) do update
set features = excluded.features;

with snapshot_seed as (
  select id, student_id, institution_id
  from public.student_risk_snapshots
  where feature_version = 'isolation-v1'
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
  case when snapshot_seed.student_id = '33333333-3333-4333-8333-333333333333'
    then '99999999-9999-4999-8999-999999999999'
    else 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  end,
  snapshot_seed.id,
  snapshot_seed.student_id,
  snapshot_seed.institution_id,
  current_date,
  'isolation-model-v1',
  case when snapshot_seed.student_id = '33333333-3333-4333-8333-333333333333' then 0.21 else 0.82 end,
  case when snapshot_seed.student_id = '33333333-3333-4333-8333-333333333333' then 'low' else 'high' end,
  case when snapshot_seed.student_id = '33333333-3333-4333-8333-333333333333'
    then array['steady_progress', 'low_risk']
    else array['negative_trend', 'missed_activity']
  end,
  case when snapshot_seed.student_id = '33333333-3333-4333-8333-333333333333'
    then 'Isolation tenant A prediction.'
    else 'Isolation tenant B prediction.'
  end,
  jsonb_build_object(
    'fixture', true,
    'institution_id', snapshot_seed.institution_id
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
  case when rp.student_id = '33333333-3333-4333-8333-333333333333'
    then 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    else 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  end,
  rp.student_id,
  rp.institution_id,
  rp.id,
  rp.snapshot_id,
  current_date,
  30,
  case when rp.student_id = '33333333-3333-4333-8333-333333333333' then 'low' else 'high' end,
  'at_risk',
  'manual',
  case when rp.student_id = '33333333-3333-4333-8333-333333333333'
    then 'Isolation tenant A outcome.'
    else 'Isolation tenant B outcome.'
  end
from public.student_risk_predictions rp
where rp.model_version = 'isolation-model-v1'
on conflict (student_id, outcome_date, label_window_days, outcome_source) do update
set
  prediction_id = excluded.prediction_id,
  snapshot_id = excluded.snapshot_id,
  label_value = excluded.label_value,
  outcome_status = excluded.outcome_status,
  notes = excluded.notes;
