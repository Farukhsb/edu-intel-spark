import { supabase } from "@/integrations/supabase/client";

const PROFILE_FIELDS = "id, full_name, email, role, created_at";
const ASSIGNMENT_FIELDS = "id, title, module_code, status, due_date, created_at, lecturer_id";
const SUBMISSION_FIELDS = "id, assignment_id, student_name, student_email, status, submitted_at, file_name";
const MODERATION_CASE_FIELDS =
  "id, assignment_id, submission_id, first_marker_id, moderator_id, status, integrity_risk_score, confidence_score, created_at, updated_at, trigger_summary, first_marker_score, moderator_score, final_agreed_score, final_agreed_feedback, moderated_at, approved_at";
const ADMIN_AUDIT_FIELDS = "id, created_at, action_type, actor_role, target_user_name, target_user_email, details";
const GRADE_AUDIT_FIELDS = "id, created_at, event_type, submission_id, moderation_case_id, reason";
const ACADEMIC_ACCESS_EVENT_FIELDS =
  "id, created_at, actor_id, actor_role, event_type, resource_type, resource_id, assignment_id, submission_id, moderation_case_id, metadata";
const COMMUNICATION_FIELDS = "id, created_at, category, subject";
const LATEST_GRADE_FIELDS = "id, created_at";
const INTEGRITY_REVIEW_FIELDS = "id, submission_id, decision, lecturer_note, review_type, created_at, updated_at";

export const fetchAdminDashboardDataset = async () => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    metricsRes,
    assignmentOversightRes,
    moderationOverviewRes,
    recentActivityRes,
    profilesRes,
    assignmentsRes,
    submissionsRes,
    moderationCasesRes,
    adminAuditRes,
    gradeAuditRes,
    academicAccessEventsRes,
    integrityReviewsRes,
    latestGradeRes,
    notificationsRes,
    gradingFailureCountRes,
  ] = await Promise.all([
    supabase.rpc("get_admin_dashboard_metrics"),
    supabase.rpc("get_admin_assignment_oversight"),
    supabase.rpc("get_admin_moderation_overview"),
    supabase.rpc("get_admin_recent_activity"),
    supabase.from("profiles").select(PROFILE_FIELDS).order("created_at", { ascending: false }),
    supabase.from("assignments").select(ASSIGNMENT_FIELDS).order("created_at", { ascending: false }),
    supabase.from("submissions").select(SUBMISSION_FIELDS).order("submitted_at", { ascending: false }),
    supabase.from("moderation_cases").select(MODERATION_CASE_FIELDS).order("updated_at", { ascending: false }),
    supabase.from("admin_audit_log").select(ADMIN_AUDIT_FIELDS).order("created_at", { ascending: false }).limit(50),
    supabase.from("grade_audit_log").select(GRADE_AUDIT_FIELDS).order("created_at", { ascending: false }).limit(25),
    supabase.from("academic_access_events").select(ACADEMIC_ACCESS_EVENT_FIELDS).order("created_at", { ascending: false }).limit(100),
    supabase.from("academic_integrity_reviews").select(INTEGRITY_REVIEW_FIELDS).order("updated_at", { ascending: false }).limit(100),
    supabase.from("grades").select(LATEST_GRADE_FIELDS).order("created_at", { ascending: false }).limit(1),
    supabase.from("communication_messages").select(COMMUNICATION_FIELDS).order("created_at", { ascending: false }).limit(10),
    supabase
      .from("grade_audit_log")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "grading_failed")
      .gte("created_at", todayStart.toISOString()),
  ]);

  if (profilesRes.error || assignmentsRes.error || submissionsRes.error || moderationCasesRes.error) {
    throw profilesRes.error || assignmentsRes.error || submissionsRes.error || moderationCasesRes.error;
  }

  return {
    metricsRes,
    assignmentOversightRes,
    moderationOverviewRes,
    recentActivityRes,
    profiles: profilesRes.data || [],
    assignments: assignmentsRes.data || [],
    submissions: submissionsRes.data || [],
    moderationCases: moderationCasesRes.data || [],
    adminAuditRes,
    gradeAuditRes,
    academicAccessEventsRes,
    integrityReviewsRes,
    latestGradeRes,
    notificationsRes,
    gradingFailureCountRes,
  };
};
