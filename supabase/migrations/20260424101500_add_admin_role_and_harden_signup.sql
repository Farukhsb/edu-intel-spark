ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _requested_role TEXT := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'student');
  _role app_role;
BEGIN
  _role := CASE
    WHEN _requested_role = 'lecturer' THEN 'lecturer'::app_role
    ELSE 'student'::app_role
  END;

  INSERT INTO public.profiles (id, full_name, email, role, cohort_id, department_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    _role,
    NULLIF(NEW.raw_user_meta_data->>'cohort_id', ''),
    NULLIF(NEW.raw_user_meta_data->>'department_id', '')
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;
