import { supabase } from "@/integrations/supabase/client";

const PROFILE_FIELDS = "id, full_name, email, role, created_at";
const ASSIGNMENT_FIELDS = "id, title, module_code, status, due_date, created_at, lecturer_id";
const SUBMISSION_FIELDS = "id, assignment_id, student_name, student_email, status, submitted_at, file_name";
const MODERATION_CASE_FIELDS =
  "id, assignment_id, first_marker_id, moderator_id, status, integrity_risk_score, confidence_score, created_at, updated_at, trigger_summary, first_marker_score, moderator_score";
const ADMIN_AUDIT_FIELDS = "id, created_at, target_user_name, target_user_email, details";
const GRADE_AUDIT_FIELDS = "id, created_at, event_type, submission_id, reason";
const COMMUNICATION_FIELDS = "id, created_at, category, subject";
const LATEST_GRADE_FIELDS = "id, created_at";

export const fetchAdminDashboardDataset = async () => {
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
    latestGradeRes,
    notificationsRes,
  ] = await Promise.all([
    supabase.rpc("get_admin_dashboard_metrics"),
    supabase.rpc("get_admin_assignment_oversight"),
    supabase.rpc("get_admin_moderation_overview"),
    supabase.rpc("get_admin_recent_activity"),
    supabase.from("profiles").select(PROFILE_FIELDS).order("created_at", { ascending: false }),
    supabase.from("assignments").select(ASSIGNMENT_FIELDS).order("created_at", { ascending: false }),
    supabase.from("submissions").select(SUBMISSION_FIELDS).order("submitted_at", { ascending: false }),
    supabase.from("moderation_cases").select(MODERATION_CASE_FIELDS).order("updated_at", { ascending: false }),
    supabase.from("admin_audit_log").select(ADMIN_AUDIT_FIELDS).eq("action_type", "role_changed").order("created_at", { ascending: false }).limit(25),
    supabase.from("grade_audit_log").select(GRADE_AUDIT_FIELDS).order("created_at", { ascending: false }).limit(25),
    supabase.from("grades").select(LATEST_GRADE_FIELDS).order("created_at", { ascending: false }).limit(1),
    supabase.from("communication_messages").select(COMMUNICATION_FIELDS).order("created_at", { ascending: false }).limit(10),
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
    latestGradeRes,
    notificationsRes,
  };
};
