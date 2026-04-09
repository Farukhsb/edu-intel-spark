
-- Remove dangerous anon read policies
DROP POLICY IF EXISTS "Anon can read submissions" ON public.submissions;
DROP POLICY IF EXISTS "Anon can read grades" ON public.grades;
DROP POLICY IF EXISTS "Anon can read assignments" ON public.assignments;
