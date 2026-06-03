// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readRepoFile = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("access policy contracts", () => {
  it("keeps student submission inserts targeted, owned, and due-date aware", () => {
    const source = readRepoFile("supabase/migrations/20260507123000_harden_submission_due_date_and_notification_updates.sql");

    expect(source).toContain('create policy "Students can submit to targeted published assignments"');
    expect(source).toContain("student_id = auth.uid()");
    expect(source).toContain("uploaded_by = auth.uid()");
    expect(source).toContain("a.status = 'published'");
    expect(source).toContain("(a.due_date is null or a.due_date > now())");
    expect(source).toContain("public.student_matches_assignment_target(a.id, auth.uid())");
  });

  it("keeps student grade reads released-only", () => {
    const source = readRepoFile("supabase/migrations/20260507160000_harden_grade_visibility_moderation_and_profile_access.sql");

    expect(source).toContain('create policy "Students can view own grades"');
    expect(source).toContain("s.student_id = (select auth.uid())");
    expect(source).toContain("s.status = 'released'");
  });

  it("keeps student grade projection released-only in the RPC", () => {
    const source = readRepoFile("supabase/migrations/20260507160000_harden_grade_visibility_moderation_and_profile_access.sql");

    expect(source).toContain("create or replace function public.get_student_submission_grade_projection()");
    expect(source).toContain("case when s.status = 'released' then g.final_score else null end as final_score");
    expect(source).toContain("case when s.status = 'released' then g.final_feedback else null end as final_feedback");
    expect(source).toContain("where s.student_id = auth.uid()");
  });

  it("keeps lecturer profile reads narrowed to directory and linked students", () => {
    const source = readRepoFile("supabase/migrations/20260507160000_harden_grade_visibility_moderation_and_profile_access.sql");

    expect(source).toContain('drop policy if exists "Lecturers can view all profiles"');
    expect(source).toContain('create policy "Lecturers can view lecturer directory"');
    expect(source).toContain("private.is_lecturer()");
    expect(source).toContain("role = 'lecturer'");
    expect(source).toContain('create policy "Lecturers can view linked student profiles"');
    expect(source).toContain("role = 'student'");
    expect(source).toContain("where s.student_id = public.profiles.id");
    expect(source).toContain("and a.lecturer_id = (select auth.uid())");
  });

  it("keeps communication message updates immutable outside read-state fields", () => {
    const source = readRepoFile("supabase/migrations/20260507123000_harden_submission_due_date_and_notification_updates.sql");

    expect(source).toContain('create policy "users can update relevant communication messages"');
    expect(source).toContain("where original.id = id");
    expect(source).toContain("and original.sender_id = sender_id");
    expect(source).toContain("and original.recipient_id is not distinct from recipient_id");
    expect(source).toContain("and original.category = category");
    expect(source).toContain("and original.subject = subject");
    expect(source).toContain("and original.body = body");
    expect(source).toContain("and original.related_assignment_id is not distinct from related_assignment_id");
  });

  it("locks submission file reads to student, uploader, assignment owner, assigned moderator, or admin", () => {
    const source = readRepoFile("supabase/migrations/20260510110000_harden_moderation_evidence_access.sql");

    expect(source).toContain("bucket_id = 'submissions'");
    expect(source).toContain("private.is_admin()");
    expect(source).toContain("s.student_id = (select auth.uid())");
    expect(source).toContain("s.uploaded_by = (select auth.uid())");
    expect(source).toContain("a.lecturer_id = (select auth.uid())");
    expect(source).toContain("mc.moderator_id = (select auth.uid())");
    expect(source).not.toContain("WHERE s.file_url = storage.objects.name\n  )");
  });

  it("keeps assigned moderator integrity-review reads explicit", () => {
    const source = readRepoFile("supabase/migrations/20260510110000_harden_moderation_evidence_access.sql");

    expect(source).toContain('create policy "Assigned moderators can view linked integrity reviews"');
    expect(source).toContain("from public.moderation_cases mc");
    expect(source).toContain("mc.submission_id = public.academic_integrity_reviews.submission_id");
    expect(source).toContain("mc.moderator_id = (select auth.uid())");
  });

  it("keeps assigned moderator submission reads explicit in table RLS", () => {
    const source = readRepoFile("supabase/migrations/20260502204500_tune_remaining_rls_initplan_policies.sql");

    expect(source).toContain('create policy "Assigned moderators can view linked submissions"');
    expect(source).toContain("on public.submissions");
    expect(source).toContain("mc.submission_id = public.submissions.id");
    expect(source).toContain("mc.moderator_id = (select auth.uid())");
  });

  it("breaks the moderation assignment recursion with a security-definer helper", () => {
    const source = readRepoFile("supabase/migrations/20260528233000_break_moderation_assignment_rls_recursion.sql");

    expect(source).toContain("create or replace function private.is_assigned_moderator_for_assignment");
    expect(source).toContain("security definer");
    expect(source).toContain("grant execute on function private.is_assigned_moderator_for_assignment(uuid) to authenticated");
    expect(source).toContain('create policy "Assigned moderators can view linked assignments"');
    expect(source).toContain("private.is_assigned_moderator_for_assignment(public.assignments.id)");
    expect(source).toContain("from public.moderation_cases mc");
    expect(source).not.toContain("using (\n  private.same_institution(institution_id)\n  and exists (\n    select 1\n    from public.moderation_cases mc");
  });

  it("uses the assignment-owner helper in moderation-case insert and update policies", () => {
    const source = readRepoFile("supabase/migrations/20260528234000_fix_moderation_case_assignment_rls_recursion.sql");

    expect(source).toContain('create policy "Lecturers can insert moderation cases"');
    expect(source).toContain('create policy "Lecturers can update moderation cases"');
    expect(source).not.toContain("private.is_assignment_owner(assignment_id)");
    expect(source).not.toContain("from public.assignments a");
  });

  it("provides an explicit security-definer lecturer moderation handoff RPC", () => {
    const source = readRepoFile("supabase/migrations/20260528240000_add_lecturer_moderation_handoff_rpc.sql");

    expect(source).toContain("create or replace function public.send_submission_to_moderation");
    expect(source).toContain("security definer");
    expect(source).toContain("Only the assignment owner can send a submission to moderation");
    expect(source).toContain("Save a lecturer score before sending to moderation");
    expect(source).toContain("grant execute on function public.send_submission_to_moderation(uuid) to authenticated");
  });

  it("keeps admin dashboard metrics behind an explicit admin check", () => {
    const source = readRepoFile("supabase/migrations/20260503120500_add_admin_dashboard_metrics_rpc.sql");

    expect(source).toContain("security definer");
    expect(source).toContain("if not private.is_admin() then");
    expect(source).toContain("raise exception 'Admin access required'");
    expect(source).toContain("grant execute on function public.get_admin_dashboard_metrics() to authenticated");
  });

  it("keeps student risk intelligence readable and writable only by admins in the same institution", () => {
    const source = readRepoFile("supabase/migrations/20260603102000_add_admin_risk_intelligence_tables.sql");
    const policies = readRepoFile("supabase/migrations/20260604104000_switch_risk_policies_to_private_is_admin.sql");

    expect(source).toContain("grant select on public.student_risk_snapshots to authenticated;");
    expect(source).toContain("grant select on public.student_risk_predictions to authenticated;");
    expect(source).toContain("grant select, insert on public.risk_feedback to authenticated;");
    expect(source).toContain("private.same_institution(institution_id)");
    expect(policies).toContain('create policy "Admins can read student risk snapshots"');
    expect(policies).toContain('create policy "Admins can read student risk predictions"');
    expect(policies).toContain('create policy "Admins can read risk feedback"');
    expect(policies).toContain('create policy "Admins can insert risk feedback"');
    expect(policies).toContain("private.is_admin()");
    expect(source).not.toContain("to public");
  });

  it("keeps supervised risk outcomes readable and writable only by admins in the same institution", () => {
    const source = readRepoFile("supabase/migrations/20260603212000_add_student_risk_outcomes.sql");
    const traceability = readRepoFile("supabase/migrations/20260604103000_add_source_grade_traceability_to_risk_outcomes.sql");
    const policies = readRepoFile("supabase/migrations/20260604104000_switch_risk_policies_to_private_is_admin.sql");

    expect(source).toContain("create table if not exists public.student_risk_outcomes");
    expect(source).toContain("prediction_id uuid references public.student_risk_predictions(id) on delete set null");
    expect(source).toContain("snapshot_id uuid references public.student_risk_snapshots(id) on delete set null");
    expect(source).toContain("grant select on public.student_risk_outcomes to authenticated;");
    expect(source).toContain("grant select, insert, update on public.student_risk_outcomes to service_role;");
    expect(traceability).toContain("create unique index if not exists idx_student_risk_outcomes_source_grade_id");
    expect(traceability).toContain("student_risk_outcomes_grade_traceability");
    expect(traceability).toContain("drop constraint if exists student_risk_outcomes_grade_traceability");
    expect(traceability).toContain("add constraint student_risk_outcomes_grade_traceability");
    expect(policies).toContain('create policy "Admins can read student risk outcomes"');
    expect(policies).toContain('create policy "Admins can insert student risk outcomes"');
    expect(policies).toContain('create policy "Admins can update student risk outcomes"');
    expect(policies).toContain("private.is_admin()");
    expect(policies).toContain("private.same_institution(institution_id)");
  });

  it("grants authenticated admins write access to risk outcomes while keeping same-institution RLS", () => {
    const source = readRepoFile("supabase/migrations/20260604105000_grant_authenticated_risk_outcomes_write_access.sql");

    expect(source).toContain("grant select, insert, update on public.student_risk_outcomes to authenticated;");
  });

  it("removes anonymous access from privileged RPC helpers", () => {
    const source = readRepoFile("supabase/migrations/20260602123000_harden_function_search_path_and_rpc_grants.sql");

    expect(source).toContain("revoke all on function public.admin_assign_user_to_institution(uuid, text) from public");
    expect(source).toContain("revoke all on function public.admin_create_institution(text, text) from public");
    expect(source).toContain("revoke all on function public.admin_update_user_profile(uuid, text, public.app_role, text, text, boolean) from public");
    expect(source).toContain("revoke all on function public.send_submission_to_moderation(uuid) from public");
  });

  it("moves read-only admin and student RPCs to invoker semantics", () => {
    const source = readRepoFile("supabase/migrations/20260602125500_reduce_security_definer_surface.sql");

    expect(source).toContain("security invoker");
    expect(source).toContain("create or replace function public.get_admin_dashboard_metrics()");
    expect(source).toContain("create or replace function public.get_admin_assignment_oversight()");
    expect(source).toContain("create or replace function public.get_admin_moderation_overview()");
    expect(source).toContain("create or replace function public.get_admin_recent_activity()");
    expect(source).toContain("create or replace function public.send_submission_to_moderation(_submission_id uuid)");
    expect(source).toContain("revoke all on function public.resolve_signup_institution_id(jsonb) from authenticated");
  });

  it("keeps remaining admin mutators on invoker semantics with narrow admin policies", () => {
    const source = readRepoFile("supabase/migrations/20260602133000_move_remaining_admin_mutators_to_invoker.sql");

    expect(source).toContain("create policy \"Admins can select institutions for provisioning\"");
    expect(source).toContain("create policy \"Admins can create institutions\"");
    expect(source).toContain("create policy \"Admins can update managed profiles\"");
    expect(source).toContain("create policy \"Admins can manage user roles\"");
    expect(source).toContain("create policy \"Admins can insert admin audit log\"");
    expect(source).toContain("security invoker");
    expect(source).toContain("create or replace function public.admin_assign_user_to_institution(");
    expect(source).toContain("create or replace function public.admin_create_institution(");
    expect(source).toContain("create or replace function public.admin_update_user_profile(");
  });

  it("keeps admin oversight RPCs filtered by private.is_admin()", () => {
    const assignmentOversight = readRepoFile("supabase/migrations/20260503122000_add_admin_assignment_oversight_rpc.sql");
    const moderationOverview = readRepoFile("supabase/migrations/20260503123500_add_admin_moderation_overview_rpc.sql");
    const recentActivity = readRepoFile("supabase/migrations/20260503125000_add_admin_recent_activity_rpc.sql");

    expect(assignmentOversight).toContain("where private.is_admin()");
    expect(assignmentOversight).toContain("grant execute on function public.get_admin_assignment_oversight() to authenticated");

    expect(moderationOverview).toContain("where private.is_admin()");
    expect(moderationOverview).toContain("grant execute on function public.get_admin_moderation_overview() to authenticated");

    expect(recentActivity).toContain("where private.is_admin()");
    expect(recentActivity).toContain("grant execute on function public.get_admin_recent_activity() to authenticated");
  });
});
