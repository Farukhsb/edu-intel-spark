CREATE OR REPLACE FUNCTION public.admin_update_user_profile(
  p_target_user_id UUID,
  p_full_name TEXT,
  p_department_id TEXT DEFAULT NULL,
  p_cohort_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  department_id TEXT,
  cohort_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_id UUID := auth.uid();
  _actor_is_admin BOOLEAN;
  _target_profile public.profiles%ROWTYPE;
  _normalized_full_name TEXT := NULLIF(BTRIM(p_full_name), '');
  _normalized_department_id TEXT := NULLIF(BTRIM(p_department_id), '');
  _normalized_cohort_id TEXT := NULLIF(BTRIM(p_cohort_id), '');
  _target_is_admin BOOLEAN;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles actor_profile
    WHERE actor_profile.id = _actor_id
      AND actor_profile.role::TEXT = 'admin'
  ) OR EXISTS (
    SELECT 1
    FROM public.user_roles actor_role
    WHERE actor_role.user_id = _actor_id
      AND actor_role.role::TEXT = 'admin'
  )
  INTO _actor_is_admin;

  IF NOT COALESCE(_actor_is_admin, FALSE) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT *
  INTO _target_profile
  FROM public.profiles
  WHERE id = p_target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user was not found';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles target_role
    WHERE target_role.user_id = p_target_user_id
      AND target_role.role::TEXT = 'admin'
  ) OR _target_profile.role::TEXT = 'admin'
  INTO _target_is_admin;

  IF COALESCE(_target_is_admin, FALSE) THEN
    RAISE EXCEPTION 'Admin profiles cannot be edited from this action';
  END IF;

  IF _target_profile.role::TEXT NOT IN ('student', 'lecturer') THEN
    RAISE EXCEPTION 'Only student and lecturer profiles can be edited from this action';
  END IF;

  IF _normalized_full_name IS NULL THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;

  IF _normalized_department_id IS NULL THEN
    RAISE EXCEPTION 'Department is required';
  END IF;

  IF _target_profile.role::TEXT = 'student' AND _normalized_cohort_id IS NULL THEN
    RAISE EXCEPTION 'Cohort is required for student profiles';
  END IF;

  IF _target_profile.role::TEXT = 'lecturer' THEN
    _normalized_cohort_id := NULL;
  END IF;

  UPDATE public.profiles
  SET
    full_name = _normalized_full_name,
    department_id = _normalized_department_id,
    cohort_id = _normalized_cohort_id
  WHERE id = p_target_user_id;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.department_id,
    p.cohort_id
  FROM public.profiles p
  WHERE p.id = p_target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_user_profile(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_user_profile(UUID, TEXT, TEXT, TEXT) TO authenticated;
