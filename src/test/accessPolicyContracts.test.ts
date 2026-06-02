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

  it("removes anonymous access from privileged RPC helpers", () => {
    const source = readRepoFile("supabase/migrations/20260602123000_harden_function_search_path_and_rpc_grants.sql");

    expect(source).toContain("revoke all on function public.admin_assign_user_to_institution(uuid, text) from public");
    expect(source).toContain("revoke all on function public.admin_create_institution(text, text) from public");
    expect(source).toContain("revoke all on function public.admin_update_user_profile(uuid, text, public.app_role, text, text, boolean) from public");
    expect(source).toContain("revoke all on function public.send_submission_to_moderation(uuid) from public");
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
