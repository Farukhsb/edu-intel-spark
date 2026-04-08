
CREATE POLICY "Anon can read grades" ON public.grades FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can read submissions" ON public.submissions FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can read assignments" ON public.assignments FOR SELECT TO anon USING (true);
