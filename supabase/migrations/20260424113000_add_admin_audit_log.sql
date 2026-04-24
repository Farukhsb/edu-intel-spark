CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role TEXT,
  action_type TEXT NOT NULL,
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_user_name TEXT,
  target_user_email TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at
  ON public.admin_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor_id
  ON public.admin_audit_log (actor_id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_user_id
  ON public.admin_audit_log (target_user_id);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view admin audit log" ON public.admin_audit_log;
CREATE POLICY "Admins can view admin audit log"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (public.is_admin());

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
  _actor_name TEXT;
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

  SELECT full_name
  INTO _actor_name
  FROM public.profiles
  WHERE id = _actor_id;

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

  INSERT INTO public.admin_audit_log (
    actor_id,
    actor_role,
    action_type,
    target_user_id,
    target_user_name,
    target_user_email,
    details
  )
  VALUES (
    _actor_id,
    'admin',
    'role_changed',
    p_target_user_id,
    COALESCE(_target_profile.full_name, _target_profile.email, 'Unknown user'),
    _target_profile.email,
    jsonb_build_object(
      'actor_name', COALESCE(_actor_name, 'Admin'),
      'previous_role', _current_role_text,
      'updated_role', _target_role_text
    )
  );

  RETURN QUERY
  SELECT
    p_target_user_id,
    _current_role_text,
    _target_role_text;
END;
$$;
