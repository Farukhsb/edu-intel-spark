drop policy if exists "Users can view their own grade imports" on public.grade_imports;
create policy "Users can view their own grade imports"
  on public.grade_imports for select
  to authenticated
  using (
    private.same_institution(institution_id)
    and (
      imported_by = auth.uid()
      or private.is_admin()
    )
  );

drop policy if exists "Users can insert their own grade imports" on public.grade_imports;
create policy "Users can insert their own grade imports"
  on public.grade_imports for insert
  to authenticated
  with check (
    private.same_institution(institution_id)
    and (
      imported_by = auth.uid()
      or private.is_admin()
    )
  );
