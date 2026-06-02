import { supabase } from "@/integrations/supabase/client";

const PROFILE_FIELDS = "id, full_name, email, role, department_name, department_id, cohort_id, must_change_password, created_at, institution_id";
const INSTITUTION_FIELDS = "id, name, slug, status";
const ASSIGNMENT_FIELDS = "id, title, module_code, status, due_date, created_at, lecturer_id";
const SUBMISSION_FIELDS = "id, assignment_id, student_name, student_email, status, submitted_at, file_name";
const MODERATION_CASE_FIELDS =
  "id, assignment_id, submission_id, first_marker_id, moderator_id, status, integrity_risk_score, confidence_score, created_at, updated_at, trigger_summary, first_marker_score, moderator_score, final_agreed_score, final_agreed_feedback, moderated_at, approved_at";
const ADMIN_AUDIT_FIELDS = "id, created_at, action_type, actor_role, target_user_name, target_user_email, details";
const GRADE_AUDIT_FIELDS = "id, created_at, event_type, submission_id, moderation_case_id, reason";
const ACADEMIC_ACCESS_EVENT_FIELDS =
  "id, created_at, actor_id, actor_role, event_type, resource_type, resource_id, assignment_id, submission_id, moderation_case_id, metadata";
const WORKFLOW_NOTIFICATION_FIELDS =
  "id, created_at, delivery_status, sent_at, last_error";
const WORKFLOW_RUN_FIELDS =
  "id, created_at, started_at, finished_at, duration_ms, workflow_name, status, provider, model, retry_count, failure_category, details";
const LATEST_GRADE_FIELDS = "id, created_at";
const INTEGRITY_REVIEW_FIELDS = "id, submission_id, decision, lecturer_note, review_type, created_at, updated_at";

export const fetchAdminDashboardDataset = async () => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const fetchGradingFailureCount = async () => {
    try {
      return await supabase
        .from("grading_error_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayStart.toISOString());
    } catch (error) {
      return {
        count: null,
        error: error instanceof Error ? error : new Error("grading error telemetry unavailable"),
      };
    }
  };

  const fetchWorkflowNotificationLog = async () => {
    try {
      return await supabase
        .from("workflow_notification_log")
        .select(WORKFLOW_NOTIFICATION_FIELDS)
        .gte("created_at", todayStart.toISOString())
        .order("created_at", { ascending: false })
        .limit(100);
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error("workflow notification telemetry unavailable"),
      };
    }
  };

  const fetchWorkflowRuns = async () => {
    try {
      return await supabase
        .from("workflow_runs")
        .select(WORKFLOW_RUN_FIELDS)
        .gte("created_at", todayStart.toISOString())
        .order("started_at", { ascending: false })
        .limit(100);
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error("workflow run telemetry unavailable"),
      };
    }
  };

  const [
    metricsRes,
    assignmentOversightRes,
    moderationOverviewRes,
    recentActivityRes,
    institutionRes,
    profilesRes,
    assignmentsRes,
    submissionsRes,
    moderationCasesRes,
    adminAuditRes,
    gradeAuditRes,
    academicAccessEventsRes,
    integrityReviewsRes,
    latestGradeRes,
    workflowRunRes,
    workflowNotificationLogRes,
    gradingFailureCountRes,
  ] = await Promise.all([
    supabase.rpc("get_admin_dashboard_metrics"),
    supabase.rpc("get_admin_assignment_oversight"),
    supabase.rpc("get_admin_moderation_overview"),
    supabase.rpc("get_admin_recent_activity"),
    supabase.from("institutions").select(INSTITUTION_FIELDS).limit(1).maybeSingle(),
    supabase.from("profiles").select(PROFILE_FIELDS).order("created_at", { ascending: false }),
    supabase.from("assignments").select(ASSIGNMENT_FIELDS).order("created_at", { ascending: false }),
    supabase.from("submissions").select(SUBMISSION_FIELDS).order("submitted_at", { ascending: false }),
    supabase.from("moderation_cases").select(MODERATION_CASE_FIELDS).order("updated_at", { ascending: false }),
    supabase.from("admin_audit_log").select(ADMIN_AUDIT_FIELDS).order("created_at", { ascending: false }).limit(50),
    supabase.from("grade_audit_log").select(GRADE_AUDIT_FIELDS).order("created_at", { ascending: false }).limit(25),
    supabase.from("academic_access_events").select(ACADEMIC_ACCESS_EVENT_FIELDS).order("created_at", { ascending: false }).limit(100),
    supabase.from("academic_integrity_reviews").select(INTEGRITY_REVIEW_FIELDS).order("updated_at", { ascending: false }).limit(100),
    supabase.from("grades").select(LATEST_GRADE_FIELDS).order("created_at", { ascending: false }).limit(1),
    fetchWorkflowRuns(),
    fetchWorkflowNotificationLog(),
    fetchGradingFailureCount(),
  ]);

  if (profilesRes.error || assignmentsRes.error || submissionsRes.error || moderationCasesRes.error) {
    throw profilesRes.error || assignmentsRes.error || submissionsRes.error || moderationCasesRes.error;
  }

  return {
    metricsRes,
    assignmentOversightRes,
    moderationOverviewRes,
    recentActivityRes,
    institution: institutionRes.data
      ? {
          id: institutionRes.data.id,
          name: institutionRes.data.name,
          slug: institutionRes.data.slug,
          status: institutionRes.data.status,
        }
      : null,
    profiles: profilesRes.data || [],
    assignments: assignmentsRes.data || [],
    submissions: submissionsRes.data || [],
    moderationCases: moderationCasesRes.data || [],
    adminAuditRes,
    gradeAuditRes,
    academicAccessEventsRes,
    integrityReviewsRes,
    latestGradeRes,
    workflowRunRes,
    workflowNotificationLogRes,
    gradingFailureCountRes,
  };
};
