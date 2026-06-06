// @vitest-environment node

import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/integrations/supabase/types";

type Role = "student" | "lecturer" | "admin";

type TenantSeed = {
  institutionId: string;
  studentId: string;
  lecturerId: string;
  adminId: string;
  cohortId: string;
  assignmentId: string;
  submissionId: string;
  gradeId: string;
  moderationCaseId: string;
  integrityReviewId: string;
  moderationReviewId: string;
  gradeAuditLogId: string;
  academicAccessEventId: string;
  adminAuditLogId: string;
  riskSnapshotId: string;
  riskPredictionId: string;
  riskOutcomeId: string;
  recommendationId: string;
  recommendationActionId: string;
  gradingErrorEventId: string;
  submissionObjectPath: string;
  emails: Record<Role, string>;
  passwords: Record<Role, string>;
};

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasLiveSupabase = Boolean(supabaseUrl && anonKey && serviceRoleKey);
const liveDescribe = hasLiveSupabase ? describe : describe.skip;

function makeClient(key: string, authHeader?: string) {
  return createClient<Database>(supabaseUrl!, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
  });
}

function makeServiceClient() {
  return makeClient(serviceRoleKey!);
}

function makeAnonClient() {
  return makeClient(anonKey!);
}

function uniqueEmail(prefix: string, runId: string) {
  return `${prefix}.${runId}@edu-intel.test`;
}

async function createAuthUser(
  supabase: SupabaseClient<Database>,
  email: string,
  password: string,
  fullName: string,
  role: Role,
) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role,
    },
  });

  expect(error).toBeNull();
  expect(data.user?.id).toBeTruthy();

  return data.user!.id;
}

async function signInAs(email: string, password: string) {
  const authClient = makeAnonClient();
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });

  expect(error).toBeNull();
  expect(data.session?.access_token).toBeTruthy();

  return makeClient(anonKey!, `Bearer ${data.session!.access_token}`);
}

async function insertRows<T>(supabase: SupabaseClient<Database>, table: keyof Database["public"]["Tables"], rows: T[]) {
  const { error } = await supabase.from(table as never).insert(rows as never);
  expect(error).toBeNull();
}

async function selectIds(
  supabase: SupabaseClient<Database>,
  table: keyof Database["public"]["Tables"],
): Promise<string[]> {
  const { data, error } = await supabase.from(table as never).select("id").order("id", { ascending: true });
  expect(error).toBeNull();
  return (data ?? []).map((row) => String((row as { id: string }).id));
}

async function downloadObject(supabase: SupabaseClient<Database>, objectPath: string) {
  return supabase.storage.from("submissions").download(objectPath);
}

async function seedTenant(runId: string, tenantSuffix: "a" | "b", institutionName: string): Promise<TenantSeed> {
  const service = makeServiceClient();
  const password = `GradeAI-${runId}-${tenantSuffix}!`;
  const institutionId = randomUUID();
  const cohortId = `cohort-${runId}-${tenantSuffix}`;
  const studentEmail = uniqueEmail(`student-${tenantSuffix}`, runId);
  const lecturerEmail = uniqueEmail(`lecturer-${tenantSuffix}`, runId);
  const adminEmail = uniqueEmail(`admin-${tenantSuffix}`, runId);

  const studentId = await createAuthUser(service, studentEmail, password, `Student ${tenantSuffix.toUpperCase()}`, "student");
  const lecturerId = await createAuthUser(service, lecturerEmail, password, `Lecturer ${tenantSuffix.toUpperCase()}`, "lecturer");
  const adminId = await createAuthUser(service, adminEmail, password, `Admin ${tenantSuffix.toUpperCase()}`, "admin");

  const assignmentId = randomUUID();
  const submissionId = randomUUID();
  const gradeId = randomUUID();
  const moderationCaseId = randomUUID();
  const integrityReviewId = randomUUID();
  const moderationReviewId = randomUUID();
  const gradeAuditLogId = randomUUID();
  const academicAccessEventId = randomUUID();
  const adminAuditLogId = randomUUID();
  const riskSnapshotId = randomUUID();
  const riskPredictionId = randomUUID();
  const riskOutcomeId = randomUUID();
  const recommendationId = `rec-${runId}-${tenantSuffix}`;
  const recommendationActionId = randomUUID();
  const gradingErrorEventId = randomUUID();
  const submissionObjectPath = `${institutionName}/${submissionId}/submission.pdf`;

  await insertRows(service, "institutions", [
    {
      id: institutionId,
      name: institutionName,
      slug: `${institutionName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${tenantSuffix}-${runId}`,
      status: "active",
    },
  ]);

  await insertRows(service, "profiles", [
    {
      id: studentId,
      full_name: `Student ${tenantSuffix.toUpperCase()}`,
      email: studentEmail,
      role: "student",
      cohort_id: cohortId,
      department_name: "Test Studies",
      department_id: "Test Studies",
      institution_id: institutionId,
    },
    {
      id: lecturerId,
      full_name: `Lecturer ${tenantSuffix.toUpperCase()}`,
      email: lecturerEmail,
      role: "lecturer",
      cohort_id: null,
      department_name: "Test Studies",
      department_id: "Test Studies",
      institution_id: institutionId,
    },
    {
      id: adminId,
      full_name: `Admin ${tenantSuffix.toUpperCase()}`,
      email: adminEmail,
      role: "admin",
      cohort_id: null,
      department_name: "Administration",
      department_id: "Administration",
      institution_id: institutionId,
    },
  ]);

  await insertRows(service, "user_roles", [
    { user_id: studentId, role: "student", institution_id: institutionId },
    { user_id: lecturerId, role: "lecturer", institution_id: institutionId },
    { user_id: adminId, role: "admin", institution_id: institutionId },
  ]);

  await insertRows(service, "assignments", [
    {
      id: assignmentId,
      institution_id: institutionId,
      lecturer_id: lecturerId,
      title: `Tenant ${tenantSuffix.toUpperCase()} Assignment`,
      description: `Assignment for tenant ${tenantSuffix.toUpperCase()}`,
      module_code: `MOD-${tenantSuffix.toUpperCase()}`,
      due_date: new Date(Date.now() + 86400000).toISOString(),
      max_score: 100,
      rubric: { criterion: "accuracy", weight: 1 },
      status: "published",
      file_url: null,
    },
  ]);

  await insertRows(service, "assignment_cohorts", [
    {
      assignment_id: assignmentId,
      cohort_id: cohortId,
      institution_id: institutionId,
    },
  ]);

  await service.storage.from("submissions").upload(submissionObjectPath, new Blob([`tenant-${tenantSuffix}`]), {
    contentType: "text/plain",
    upsert: true,
  });

  await insertRows(service, "submissions", [
    {
      id: submissionId,
      institution_id: institutionId,
      assignment_id: assignmentId,
      student_id: studentId,
      student_email: studentEmail,
      student_name: `Student ${tenantSuffix.toUpperCase()}`,
      file_name: `submission-${tenantSuffix}.pdf`,
      file_type: "application/pdf",
      file_url: submissionObjectPath,
      uploaded_by: studentId,
      status: "released",
      submitted_at: new Date().toISOString(),
    },
  ]);

  await insertRows(service, "grades", [
    {
      id: gradeId,
      institution_id: institutionId,
      submission_id: submissionId,
      assignment_type: "essay",
      lecturer_feedback: `Lecturer feedback ${tenantSuffix.toUpperCase()}`,
      lecturer_score: 84,
      ai_feedback: `AI feedback ${tenantSuffix.toUpperCase()}`,
      ai_score: 82,
      final_feedback: `Final feedback ${tenantSuffix.toUpperCase()}`,
      final_score: 83,
      grading_confidence: 0.91,
      grading_metadata: { seed: tenantSuffix, institution_id: institutionId },
      ai_breakdown: { clarity: 0.8, structure: 0.7 },
      reviewed_by: lecturerId,
      reviewed_at: new Date().toISOString(),
    },
  ]);

  await insertRows(service, "moderation_cases", [
    {
      id: moderationCaseId,
      institution_id: institutionId,
      assignment_id: assignmentId,
      submission_id: submissionId,
      grade_id: gradeId,
      lecturer_id: lecturerId,
      first_marker_id: lecturerId,
      moderator_id: lecturerId,
      status: "moderation_pending",
      integrity_risk_score: tenantSuffix === "a" ? 81 : 72,
      confidence_score: 0.73,
      ai_score_snapshot: 82,
      first_marker_score: 84,
      moderator_score: 83,
      trigger_flags: { tenant: tenantSuffix, seeded: true },
      trigger_summary: `Seeded moderation case ${tenantSuffix.toUpperCase()}`,
    },
  ]);

  await insertRows(service, "academic_integrity_reviews", [
    {
      id: integrityReviewId,
      institution_id: institutionId,
      submission_id: submissionId,
      lecturer_id: lecturerId,
      review_type: "ai-writing-suspicion",
      decision: "investigate",
      evidence_summary: `Integrity review ${tenantSuffix.toUpperCase()}`,
      lecturer_note: `Lecturer note ${tenantSuffix.toUpperCase()}`,
    },
  ]);

  await insertRows(service, "moderation_reviews", [
    {
      id: moderationReviewId,
      institution_id: institutionId,
      moderation_case_id: moderationCaseId,
      submission_id: submissionId,
      reviewer_id: lecturerId,
      reviewer_role: "lecturer",
      action: "approve",
      notes: `Moderation review ${tenantSuffix.toUpperCase()}`,
      proposed_feedback: `Proposed feedback ${tenantSuffix.toUpperCase()}`,
      proposed_score: 83,
      snapshot: { tenant: tenantSuffix, institution_id: institutionId },
    },
  ]);

  await insertRows(service, "grade_audit_log", [
    {
      id: gradeAuditLogId,
      institution_id: institutionId,
      submission_id: submissionId,
      grade_id: gradeId,
      moderation_case_id: moderationCaseId,
      changed_by: lecturerId,
      actor_role: "lecturer",
      event_type: "grade_created",
      previous_values: {},
      new_values: { final_score: 83 },
      reason: `Grade audit ${tenantSuffix.toUpperCase()}`,
    },
  ]);

  await insertRows(service, "academic_access_events", [
    {
      id: academicAccessEventId,
      institution_id: institutionId,
      actor_id: adminId,
      actor_role: "admin",
      assignment_id: assignmentId,
      submission_id: submissionId,
      moderation_case_id: moderationCaseId,
      event_type: "view",
      resource_type: "dashboard",
      resource_id: submissionId,
      metadata: { tenant: tenantSuffix, institution_id: institutionId },
    },
  ]);

  await insertRows(service, "admin_audit_log", [
    {
      id: adminAuditLogId,
      institution_id: institutionId,
      actor_id: adminId,
      actor_role: "admin",
      action_type: "tenant-audit",
      target_user_id: studentId,
      target_user_email: studentEmail,
      target_user_name: `Student ${tenantSuffix.toUpperCase()}`,
      details: { tenant: tenantSuffix, institution_id: institutionId },
    },
  ]);

  await insertRows(service, "student_risk_snapshots", [
    {
      id: riskSnapshotId,
      institution_id: institutionId,
      student_id: studentId,
      snapshot_date: new Date().toISOString().slice(0, 10),
      feature_version: "runtime-access-test",
      features: {
        scoreCount: 2,
        average: tenantSuffix === "a" ? 74 : 41,
        last: tenantSuffix === "a" ? 76 : 39,
      },
    },
  ]);

  await insertRows(service, "student_risk_predictions", [
    {
      id: riskPredictionId,
      institution_id: institutionId,
      snapshot_id: riskSnapshotId,
      student_id: studentId,
      model_version: "runtime-model-v1",
      risk_score: tenantSuffix === "a" ? 0.21 : 0.82,
      risk_band: tenantSuffix === "a" ? "low" : "high",
      reason_codes: ["runtime-seed", `tenant-${tenantSuffix}`],
      explanation: `Runtime risk prediction ${tenantSuffix.toUpperCase()}`,
      details: { tenant: tenantSuffix, institution_id: institutionId },
    },
  ]);

  await insertRows(service, "student_risk_outcomes", [
    {
      id: riskOutcomeId,
      institution_id: institutionId,
      student_id: studentId,
      prediction_id: riskPredictionId,
      snapshot_id: riskSnapshotId,
      outcome_date: new Date().toISOString().slice(0, 10),
      label_window_days: 30,
      label_value: tenantSuffix === "a" ? "low" : "high",
      outcome_status: "at_risk",
      outcome_source: "manual",
      notes: `Runtime risk outcome ${tenantSuffix.toUpperCase()}`,
    },
  ]);

  await insertRows(service, "analytics_recommendations", [
    {
      id: recommendationId,
      institution_id: institutionId,
      lecturer_id: lecturerId,
      assignment_id: assignmentId,
      type: "assessment",
      rule_code: "runtime-seed",
      title: `Runtime recommendation ${tenantSuffix.toUpperCase()}`,
      summary: `Recommendation summary ${tenantSuffix.toUpperCase()}`,
      explanation: `Recommendation explanation ${tenantSuffix.toUpperCase()}`,
      severity: "high",
      confidence: 0.88,
      recommended_actions: [{ action: "review", tenant: tenantSuffix }],
      evidence: { tenant: tenantSuffix, institution_id: institutionId },
      status: "open",
    },
  ]);

  await insertRows(service, "recommendation_actions", [
    {
      id: recommendationActionId,
      institution_id: institutionId,
      recommendation_id: recommendationId,
      lecturer_id: lecturerId,
      action_type: "review",
      payload: { tenant: tenantSuffix, institution_id: institutionId },
    },
  ]);

  await insertRows(service, "grading_error_events", [
    {
      id: gradingErrorEventId,
      institution_id: institutionId,
      assignment_id: assignmentId,
      submission_id: submissionId,
      user_id: lecturerId,
      error_code: `runtime-error-${tenantSuffix}`,
      error_message: `Runtime grading error ${tenantSuffix.toUpperCase()}`,
      provider: "openai",
      safe_error_category: "provider",
      metadata: { tenant: tenantSuffix, institution_id: institutionId },
    },
  ]);

  return {
    institutionId,
    studentId,
    lecturerId,
    adminId,
    cohortId,
    assignmentId,
    submissionId,
    gradeId,
    moderationCaseId,
    integrityReviewId,
    moderationReviewId,
    gradeAuditLogId,
    academicAccessEventId,
    adminAuditLogId,
    riskSnapshotId,
    riskPredictionId,
    riskOutcomeId,
    recommendationId,
    recommendationActionId,
    gradingErrorEventId,
    submissionObjectPath,
    emails: {
      student: studentEmail,
      lecturer: lecturerEmail,
      admin: adminEmail,
    },
    passwords: {
      student: password,
      lecturer: password,
      admin: password,
    },
  };
}

liveDescribe("GradeAI live access control integration", () => {
  const runId = randomUUID().slice(0, 8);
  let tenantA: TenantSeed;
  let tenantB: TenantSeed;
  let studentClient: SupabaseClient<Database>;
  let lecturerClient: SupabaseClient<Database>;
  let adminClient: SupabaseClient<Database>;
  let anonClient: SupabaseClient<Database>;
  let serviceClient: SupabaseClient<Database>;

  beforeAll(async () => {
    if (!hasLiveSupabase) {
      return;
    }

    tenantA = await seedTenant(runId, "a", `Runtime Institution A ${runId}`);
    tenantB = await seedTenant(runId, "b", `Runtime Institution B ${runId}`);

    studentClient = await signInAs(tenantA.emails.student, tenantA.passwords.student);
    lecturerClient = await signInAs(tenantA.emails.lecturer, tenantA.passwords.lecturer);
    adminClient = await signInAs(tenantA.emails.admin, tenantA.passwords.admin);
    anonClient = makeAnonClient();
    serviceClient = makeServiceClient();
  });

  afterAll(async () => {
    if (!hasLiveSupabase) {
      return;
    }

    const service = makeServiceClient();
    const cleanupTables: Array<keyof Database["public"]["Tables"]> = [
      "recommendation_actions",
      "analytics_recommendations",
      "grading_error_events",
      "student_risk_outcomes",
      "student_risk_predictions",
      "student_risk_snapshots",
      "admin_audit_log",
      "academic_access_events",
      "grade_audit_log",
      "moderation_reviews",
      "academic_integrity_reviews",
      "moderation_cases",
      "grades",
      "submissions",
      "assignment_cohorts",
      "assignments",
      "user_roles",
      "profiles",
      "institutions",
    ];

    await service.storage.from("submissions").remove([tenantA.submissionObjectPath, tenantB.submissionObjectPath]);

    for (const table of cleanupTables) {
      await service.from(table as never).delete().in("institution_id", [tenantA.institutionId, tenantB.institutionId] as never);
    }

    for (const userId of [
      tenantA.studentId,
      tenantA.lecturerId,
      tenantA.adminId,
      tenantB.studentId,
      tenantB.lecturerId,
      tenantB.adminId,
    ]) {
      await service.auth.admin.deleteUser(userId);
    }
  });

  it("keeps students inside their own submissions, grades, profiles, and files", async () => {
    const [assignmentIds, submissionIds, gradeIds, profileIds] = await Promise.all([
      selectIds(studentClient, "assignments"),
      selectIds(studentClient, "submissions"),
      selectIds(studentClient, "grades"),
      selectIds(studentClient, "profiles"),
    ]);

    expect(assignmentIds).toEqual([tenantA.assignmentId]);
    expect(submissionIds).toEqual([tenantA.submissionId]);
    expect(gradeIds).toEqual([tenantA.gradeId]);
    expect(profileIds).toEqual([tenantA.studentId]);

    const allowedDownload = await downloadObject(studentClient, tenantA.submissionObjectPath);
    expect(allowedDownload.error).toBeNull();
    expect(allowedDownload.data).toBeInstanceOf(Blob);

    const deniedDownload = await downloadObject(studentClient, tenantB.submissionObjectPath);
    expect(deniedDownload.data).toBeNull();
    expect(deniedDownload.error).toBeTruthy();
  });

  it("keeps lecturers inside their assignment, cohort, and institution scope", async () => {
    const [assignmentIds, submissionIds, gradeIds, profileIds, moderationCaseIds, integrityReviewIds, moderationReviewIds, recommendationIds, recommendationActionIds, gradeAuditLogIds] =
      await Promise.all([
        selectIds(lecturerClient, "assignments"),
        selectIds(lecturerClient, "submissions"),
        selectIds(lecturerClient, "grades"),
        selectIds(lecturerClient, "profiles"),
        selectIds(lecturerClient, "moderation_cases"),
        selectIds(lecturerClient, "academic_integrity_reviews"),
        selectIds(lecturerClient, "moderation_reviews"),
        selectIds(lecturerClient, "analytics_recommendations"),
        selectIds(lecturerClient, "recommendation_actions"),
        selectIds(lecturerClient, "grade_audit_log"),
      ]);

    expect(assignmentIds).toEqual([tenantA.assignmentId]);
    expect(submissionIds).toEqual([tenantA.submissionId]);
    expect(gradeIds).toEqual([tenantA.gradeId]);
    expect(profileIds).toEqual(expect.arrayContaining([tenantA.studentId, tenantA.lecturerId, tenantA.adminId]));
    expect(profileIds).not.toContain(tenantB.studentId);
    expect(moderationCaseIds).toEqual([tenantA.moderationCaseId]);
    expect(integrityReviewIds).toEqual([tenantA.integrityReviewId]);
    expect(moderationReviewIds).toEqual([tenantA.moderationReviewId]);
    expect(recommendationIds).toEqual([tenantA.recommendationId]);
    expect(recommendationActionIds).toEqual([tenantA.recommendationActionId]);
    expect(gradeAuditLogIds).toEqual([tenantA.gradeAuditLogId]);

    const allowedDownload = await downloadObject(lecturerClient, tenantA.submissionObjectPath);
    expect(allowedDownload.error).toBeNull();
    expect(allowedDownload.data).toBeInstanceOf(Blob);

    const deniedDownload = await downloadObject(lecturerClient, tenantB.submissionObjectPath);
    expect(deniedDownload.data).toBeNull();
    expect(deniedDownload.error).toBeTruthy();
  });

  it("keeps admins confined to their institution for dashboard and risk data", async () => {
    const dashboard = await adminClient.rpc("get_admin_dashboard_metrics");
    expect(dashboard.error).toBeNull();
    expect(dashboard.data).toEqual([
      {
        total_users: 3,
        active_lecturers: 1,
        active_students: 1,
        total_assignments: 1,
        total_submissions: 1,
        pending_moderation_cases: 1,
        high_integrity_risk_cases: 1,
      },
    ]);

    const [profileIds, assignmentIds, submissionIds, moderationCaseIds, accessEventIds, adminAuditLogIds, snapshotIds, predictionIds, outcomeIds, gradingErrorIds] =
      await Promise.all([
        selectIds(adminClient, "profiles"),
        selectIds(adminClient, "assignments"),
        selectIds(adminClient, "submissions"),
        selectIds(adminClient, "moderation_cases"),
        selectIds(adminClient, "academic_access_events"),
        selectIds(adminClient, "admin_audit_log"),
        selectIds(adminClient, "student_risk_snapshots"),
        selectIds(adminClient, "student_risk_predictions"),
        selectIds(adminClient, "student_risk_outcomes"),
        selectIds(adminClient, "grading_error_events"),
      ]);

    expect(profileIds).toEqual(expect.arrayContaining([tenantA.studentId, tenantA.lecturerId, tenantA.adminId]));
    expect(profileIds).not.toContain(tenantB.studentId);
    expect(assignmentIds).toEqual([tenantA.assignmentId]);
    expect(submissionIds).toEqual([tenantA.submissionId]);
    expect(moderationCaseIds).toEqual([tenantA.moderationCaseId]);
    expect(accessEventIds).toEqual([tenantA.academicAccessEventId]);
    expect(adminAuditLogIds).toEqual([tenantA.adminAuditLogId]);
    expect(snapshotIds).toEqual([tenantA.riskSnapshotId]);
    expect(predictionIds).toEqual([tenantA.riskPredictionId]);
    expect(outcomeIds).toEqual([tenantA.riskOutcomeId]);
    expect(gradingErrorIds).toEqual([tenantA.gradingErrorEventId]);
  });

  it("keeps anonymous users out of dashboard data", async () => {
    const [assignmentIds, submissionIds, gradeIds, profileIds, moderationCaseIds] = await Promise.all([
      selectIds(anonClient, "assignments"),
      selectIds(anonClient, "submissions"),
      selectIds(anonClient, "grades"),
      selectIds(anonClient, "profiles"),
      selectIds(anonClient, "moderation_cases"),
    ]);

    expect(assignmentIds).toEqual([]);
    expect(submissionIds).toEqual([]);
    expect(gradeIds).toEqual([]);
    expect(profileIds).toEqual([]);
    expect(moderationCaseIds).toEqual([]);
  });

  it("keeps service role access privileged and server-side only", async () => {
    const [assignmentIds, submissionIds, profileIds] = await Promise.all([
      selectIds(serviceClient, "assignments"),
      selectIds(serviceClient, "submissions"),
      selectIds(serviceClient, "profiles"),
    ]);

    expect(assignmentIds).toEqual(expect.arrayContaining([tenantA.assignmentId, tenantB.assignmentId]));
    expect(submissionIds).toEqual(expect.arrayContaining([tenantA.submissionId, tenantB.submissionId]));
    expect(profileIds).toEqual(expect.arrayContaining([tenantA.studentId, tenantB.studentId, tenantA.adminId, tenantB.adminId]));
  });
});
