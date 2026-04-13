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
  _role app_role;
BEGIN
  _role := COALESCE(
    (NEW.raw_user_meta_data->>'role')::app_role,
    'student'
  );

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
