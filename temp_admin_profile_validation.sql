ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated',
    'authenticated',
    'admin.local@test.com',
    'x',
    now(),
    '{}'::jsonb,
    '{"role":"admin","full_name":"Alex Admin","department_id":"Operations"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated',
    'authenticated',
    'student.local@test.com',
    'x',
    now(),
    '{}'::jsonb,
    '{"role":"student","full_name":"Sally Student","department_id":"Computer Science","cohort_id":"200"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated',
    'authenticated',
    'lecturer.local@test.com',
    'x',
    now(),
    '{}'::jsonb,
    '{"role":"lecturer","full_name":"Lena Lecturer","department_id":"Mathematics"}'::jsonb,
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

SELECT 'function_exists' AS check_name, proname
FROM pg_proc
WHERE proname = 'admin_update_user_profile';

SELECT 'student_profile_edit' AS check_name, *
FROM public.admin_update_user_profile(
  '22222222-2222-2222-2222-222222222222',
  'Sally Student Updated',
  'Data Science',
  '300'
);

SELECT 'student_profile_row' AS check_name, id, full_name, department_id, cohort_id
FROM public.profiles
WHERE id = '22222222-2222-2222-2222-222222222222';

SELECT 'lecturer_profile_edit' AS check_name, *
FROM public.admin_update_user_profile(
  '33333333-3333-3333-3333-333333333333',
  'Lena Lecturer Updated',
  'Applied Mathematics',
  '999'
);

SELECT 'lecturer_profile_row' AS check_name, id, full_name, department_id, cohort_id
FROM public.profiles
WHERE id = '33333333-3333-3333-3333-333333333333';

SELECT 'role_change' AS check_name, *
FROM public.admin_set_user_role(
  '22222222-2222-2222-2222-222222222222',
  'lecturer'
);

SELECT 'role_rows' AS check_name, p.id, p.role::text AS profile_role, ur.role::text AS user_role
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.id
WHERE p.id = '22222222-2222-2222-2222-222222222222';
