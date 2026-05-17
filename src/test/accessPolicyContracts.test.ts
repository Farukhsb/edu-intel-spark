// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readRepoFile = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("access policy contracts", () => {
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
});
