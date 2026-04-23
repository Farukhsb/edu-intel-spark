SELECT set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

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
