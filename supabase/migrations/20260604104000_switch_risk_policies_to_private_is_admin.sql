drop policy if exists "Admins can read student risk snapshots" on public.student_risk_snapshots;
create policy "Admins can read student risk snapshots"
  on public.student_risk_snapshots
  for select
  to authenticated
  using (
    private.is_admin()
    and private.same_institution(institution_id)
  );

drop policy if exists "Admins can read student risk predictions" on public.student_risk_predictions;
create policy "Admins can read student risk predictions"
  on public.student_risk_predictions
  for select
  to authenticated
  using (
    private.is_admin()
    and private.same_institution(institution_id)
  );

drop policy if exists "Admins can read risk feedback" on public.risk_feedback;
create policy "Admins can read risk feedback"
  on public.risk_feedback
  for select
  to authenticated
  using (
    private.is_admin()
    and private.same_institution(institution_id)
  );

drop policy if exists "Admins can insert risk feedback" on public.risk_feedback;
create policy "Admins can insert risk feedback"
  on public.risk_feedback
  for insert
  to authenticated
  with check (
    private.is_admin()
    and private.same_institution(institution_id)
  );

drop policy if exists "Admins can read student risk outcomes" on public.student_risk_outcomes;
create policy "Admins can read student risk outcomes"
  on public.student_risk_outcomes
  for select
  to authenticated
  using (
    private.is_admin()
    and private.same_institution(institution_id)
  );

drop policy if exists "Admins can insert student risk outcomes" on public.student_risk_outcomes;
create policy "Admins can insert student risk outcomes"
  on public.student_risk_outcomes
  for insert
  to authenticated
  with check (
    private.is_admin()
    and private.same_institution(institution_id)
  );

drop policy if exists "Admins can update student risk outcomes" on public.student_risk_outcomes;
create policy "Admins can update student risk outcomes"
  on public.student_risk_outcomes
  for update
  to authenticated
  using (
    private.is_admin()
    and private.same_institution(institution_id)
  )
  with check (
    private.is_admin()
    and private.same_institution(institution_id)
  );
