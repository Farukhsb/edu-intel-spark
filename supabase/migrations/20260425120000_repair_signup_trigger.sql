ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS cohort_id TEXT,
ADD COLUMN IF NOT EXISTS department_id TEXT;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _requested_role TEXT := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'student');
  _role public.app_role;
BEGIN
  _role := CASE
    WHEN _requested_role = 'lecturer' THEN 'lecturer'::public.app_role
    ELSE 'student'::public.app_role
  END;

  INSERT INTO public.profiles (id, full_name, email, role, cohort_id, department_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    _role,
    NULLIF(NEW.raw_user_meta_data->>'cohort_id', ''),
    NULLIF(NEW.raw_user_meta_data->>'department_id', '')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    cohort_id = EXCLUDED.cohort_id,
    department_id = EXCLUDED.department_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
