// @vitest-environment node

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

const readRepoFile = (path: string) => readFileSync(join(repoRoot, path), "utf8");

function collectSourceFiles(rootDirs: string[]) {
  const files: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const absolutePath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }

      if (/\.(ts|tsx)$/.test(entry.name)) {
        files.push(absolutePath);
      }
    }
  };

  for (const rootDir of rootDirs) {
    walk(join(repoRoot, rootDir));
  }

  return files;
}

function readFiles(paths: string[]) {
  return paths.map((path) => readRepoFile(path)).join("\n");
}

describe("GradeAI access control suite", () => {
  it("keeps student reads self-owned and released-only", () => {
    const source = readFiles([
      "supabase/migrations/20260501113000_restore_authenticated_api_grants_and_student_projection_rpc.sql",
      "supabase/migrations/20260502195500_consolidate_rls_policies_and_auth_uid_usage.sql",
      "supabase/migrations/20260507160000_harden_grade_visibility_moderation_and_profile_access.sql",
      "supabase/migrations/20260606120000_harden_multi_tenant_admin_and_student_surfaces.sql",
    ]);

    expect(source).toContain('create policy "Students can view own submissions"');
    expect(source).toContain("student_id = (select auth.uid())");
    expect(source).toContain('create policy "Students can submit to targeted published assignments"');
    expect(source).toContain("uploaded_by = (select auth.uid())");
    expect(source).toContain('create policy "Students can view own grades"');
    expect(source).toContain("s.student_id = (select auth.uid())");
    expect(source).toContain("s.status = 'released'");
    expect(source).toContain('create policy "Users can view own profile"');
    expect(source).not.toContain("create policy \"Students can view own grades\"\non public.grades\nfor select\nto anon");
  });

  it("keeps lecturers within assignment, cohort, and institution boundaries", () => {
    const source = readFiles([
      "supabase/migrations/20260502195500_consolidate_rls_policies_and_auth_uid_usage.sql",
      "supabase/migrations/20260502203000_tune_rls_initplan_on_core_tables.sql",
      "supabase/migrations/20260502204500_tune_remaining_rls_initplan_policies.sql",
      "supabase/migrations/20260507160000_harden_grade_visibility_moderation_and_profile_access.sql",
      "supabase/migrations/20260510110000_harden_moderation_evidence_access.sql",
      "supabase/migrations/20260525103000_scope_remaining_multi_tenant_surfaces.sql",
      "supabase/migrations/20260525100000_enforce_multi_tenant_rls.sql",
    ]);

    expect(source).toContain('create policy "Lecturers can manage own assignments"');
    expect(source).toContain('create policy "Lecturers can view submissions for own assignments"');
    expect(source).toContain('create policy "Lecturers can manage grades for own assignments"');
    expect(source).toContain('create policy "Lecturers can view lecturer directory"');
    expect(source).toContain('create policy "Lecturers can view linked student profiles"');
    expect(source).toContain('create policy "Lecturers can manage own interventions"');
    expect(source).toContain('create policy "Lecturers can view moderation reviews"');
    expect(source).toContain('create policy "Lecturers can insert moderation reviews"');
    expect(source).toContain('create policy "Assigned moderators can view linked integrity reviews"');
    expect(source).toContain('create policy "Lecturers can view own analytics recommendations"');
    expect(source).toContain('create policy "Lecturers can view own recommendation actions"');
    expect(source).toContain("private.is_assignment_owner(assignment_id)");
    expect(source).toContain("private.same_institution(institution_id)");
    expect(source).toContain("bucket_id = 'submissions'");
    expect(source).toContain("mc.moderator_id = (select auth.uid())");
    expect(source).toContain("a.institution_id = public.analytics_recommendations.institution_id");
  });

  it("keeps admin reads confined to the current institution", () => {
    const source = readFiles([
      "supabase/migrations/20260502223000_add_admin_read_policies_for_dashboard.sql",
      "supabase/migrations/20260525103000_scope_remaining_multi_tenant_surfaces.sql",
      "supabase/migrations/20260604104000_switch_risk_policies_to_private_is_admin.sql",
      "supabase/migrations/20260606120000_harden_multi_tenant_admin_and_student_surfaces.sql",
      "supabase/migrations/20260606131000_harden_grading_error_events_institution_scope.sql",
    ]);

    expect(source).toContain('create policy "Admins can view all profiles"');
    expect(source).toContain('create policy "Admins can view all assignments"');
    expect(source).toContain('create policy "Admins can view all submissions"');
    expect(source).toContain('create policy "Admins can view all moderation cases"');
    expect(source).toContain('create policy "Admins can view all academic access events"');
    expect(source).toContain('create policy "Admins can read grading error events"');
    expect(source).toContain('create policy "Admins can read student risk snapshots"');
    expect(source).toContain('create policy "Admins can read student risk predictions"');
    expect(source).toContain('create policy "Admins can read student risk outcomes"');
    expect(source).toContain("private.current_institution_id()");
    expect(source).toContain("private.same_institution(institution_id)");
    expect(source).toContain("private.is_admin()");
    expect(source).not.toContain("create policy \"Admins can view all profiles\"\non public.profiles\nfor select\nto anon");
    expect(source).not.toContain("create policy \"Admins can view all assignments\"\non public.assignments\nfor select\nto anon");
  });

  it("keeps anonymous users out of dashboard and privileged data paths", () => {
    const source = readFiles([
      "supabase/migrations/20260501113000_restore_authenticated_api_grants_and_student_projection_rpc.sql",
      "supabase/migrations/20260507073500_grant_service_role_assignment_targeting_and_workflow_log.sql",
      "supabase/migrations/20260510110000_harden_moderation_evidence_access.sql",
      "supabase/migrations/20260602123000_harden_function_search_path_and_rpc_grants.sql",
      "supabase/migrations/20260602125500_reduce_security_definer_surface.sql",
      "supabase/migrations/20260606133000_harden_grade_imports_institution_scope.sql",
    ]);

    expect(source).toContain("grant select, update on public.profiles to authenticated;");
    expect(source).toContain("grant select, insert, update on public.submissions to authenticated;");
    expect(source).toContain("grant select, insert, update on public.grades to authenticated;");
    expect(source).toContain("grant execute on function public.get_student_submission_grade_projection() to authenticated;");
    expect(source).toContain("revoke all on function public.resolve_signup_institution_id(jsonb) from anon");
    expect(source).toContain("revoke all on function public.send_submission_to_moderation(uuid) from public");
    expect(source).toContain("private.same_institution(institution_id)");
    expect(source).not.toContain("to anon");
  });

  it("keeps service-role access server-side only", () => {
    const serverFiles = collectSourceFiles(["supabase/functions"]);
    const clientFiles = collectSourceFiles(["src/components", "src/lib", "src/pages"]);

    const serverSource = serverFiles.map((file) => readFileSync(file, "utf8")).join("\n");
    const clientSource = clientFiles.map((file) => readFileSync(file, "utf8")).join("\n");

    expect(serverSource).toContain("createAdminClient()");
    expect(serverSource).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(clientSource).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(clientSource).not.toContain("createAdminClient()");
  });

  it("keeps demo mode on synthetic data and away from live Supabase reads", () => {
    const demoFiles = [
      "src/components/DemoDashboardLayout.tsx",
      "src/lib/demoNotifications.ts",
      "src/pages/dashboard/assignments/useDemoAssignmentsData.ts",
      "src/pages/dashboard/cohort-analytics/useDemoCohortAnalyticsController.ts",
      "src/pages/dashboard/performance-trends/demoData.ts",
      "src/pages/dashboard/accreditation-dashboard/useDemoAccreditationDashboardController.ts",
      "src/pages/dashboard/moderation-dashboard/useDemoModerationDashboardController.ts",
      "src/pages/dashboard/academic-integrity/useDemoAcademicIntegrityController.ts",
    ];
    const source = readFiles(demoFiles);

    expect(source).toContain("DEMO_");
    expect(source).toContain("/demo/dashboard");
    expect(source).toContain("demoData");
    expect(source).not.toContain("@/integrations/supabase/client");
    expect(source).not.toContain("createAdminClient()");
    expect(source).not.toContain("supabase.from(");
  });
});
