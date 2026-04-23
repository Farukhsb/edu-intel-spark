CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  p_target_user_id UUID,
  p_target_role public.app_role
)
RETURNS TABLE (
  user_id UUID,
  previous_role TEXT,
  updated_role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_id UUID := auth.uid();
  _actor_is_admin BOOLEAN;
  _target_profile public.profiles%ROWTYPE;
  _current_role_text TEXT;
  _target_role_text TEXT := p_target_role::TEXT;
  _target_is_admin BOOLEAN;
  _role_count INTEGER;
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

  IF p_target_user_id = _actor_id THEN
    RAISE EXCEPTION 'Admin users cannot change their own role';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles target_role
    WHERE target_role.user_id = p_target_user_id
      AND target_role.role::TEXT = 'admin'
  ) OR _target_profile.role::TEXT = 'admin'
  INTO _target_is_admin;

  IF COALESCE(_target_is_admin, FALSE) THEN
    RAISE EXCEPTION 'Admin users cannot be changed by this action';
  END IF;

  _current_role_text := _target_profile.role::TEXT;

  IF _current_role_text NOT IN ('student', 'lecturer') THEN
    RAISE EXCEPTION 'Unsupported current role: %', _current_role_text;
  END IF;

  IF _target_role_text NOT IN ('student', 'lecturer') THEN
    RAISE EXCEPTION 'Unsupported target role: %', _target_role_text;
  END IF;

  IF _current_role_text = _target_role_text THEN
    RAISE EXCEPTION 'Role is already set to %', _target_role_text;
  END IF;

  IF NOT (
    (_current_role_text = 'student' AND _target_role_text = 'lecturer') OR
    (_current_role_text = 'lecturer' AND _target_role_text = 'student')
  ) THEN
    RAISE EXCEPTION 'Only student and lecturer role changes are supported';
  END IF;

  SELECT COUNT(*)
  INTO _role_count
  FROM public.user_roles ur
  WHERE ur.user_id = p_target_user_id
    AND ur.role::TEXT IN ('student', 'lecturer');

  IF _role_count <> 1 THEN
    RAISE EXCEPTION 'Conflicting user_roles state for target user';
  END IF;

  UPDATE public.profiles
  SET role = p_target_role
  WHERE id = p_target_user_id;

  DELETE FROM public.user_roles ur
  WHERE ur.user_id = p_target_user_id
    AND ur.role::TEXT IN ('student', 'lecturer');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_target_user_id, p_target_role);

  RETURN QUERY
  SELECT
    p_target_user_id,
    _current_role_text,
    _target_role_text;
END;
$$;
