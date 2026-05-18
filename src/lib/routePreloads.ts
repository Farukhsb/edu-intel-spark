import type { AppRole } from "@/lib/roles";

const loadAuth = () => import("@/pages/Auth");
const loadNotFound = () => import("@/pages/NotFound");
const loadPrivacy = () => import("@/pages/Privacy");
const loadResetPassword = () => import("@/pages/ResetPassword");
const loadForcePasswordChange = () => import("@/pages/ForcePasswordChange");
const loadDashboardLayout = () =>
  import("@/components/DashboardLayout").then((module) => ({ default: module.DashboardLayout }));
const loadLecturerOverview = () => import("@/pages/dashboard/LecturerOverview");
const loadCohortAnalytics = () => import("@/pages/dashboard/CohortAnalytics");
const loadPerformanceTrends = () => import("@/pages/dashboard/PerformanceTrends");
const loadAcademicIntegrity = () => import("@/pages/dashboard/AcademicIntegrity");
const loadModerationDashboard = () => import("@/pages/dashboard/ModerationDashboard");
const loadAdminDashboard = () => import("@/pages/dashboard/AdminDashboard");
const loadInstitutionalInsights = () => import("@/pages/dashboard/InstitutionalInsights");
const loadLearningOutcomes = () => import("@/pages/dashboard/LearningOutcomes");
const loadStudentGrades = () => import("@/pages/dashboard/StudentGrades");
const loadExplainGrade = () => import("@/pages/dashboard/ExplainGrade");
const loadImprovementPlan = () => import("@/pages/dashboard/ImprovementPlan");
const loadAssignments = () => import("@/pages/dashboard/Assignments");
const loadAssignmentDetail = () => import("@/pages/dashboard/AssignmentDetail");
const loadStudentProfile = () => import("@/pages/dashboard/StudentProfile");
const loadAccreditationDashboard = () => import("@/pages/dashboard/AccreditationDashboard");
const loadExternalExaminerExport = () => import("@/pages/dashboard/ExternalExaminerExport");
const loadSettings = () => import("@/pages/dashboard/Settings");

export const routeLoaders = {
  auth: loadAuth,
  notFound: loadNotFound,
  privacy: loadPrivacy,
  resetPassword: loadResetPassword,
  forcePasswordChange: loadForcePasswordChange,
  dashboardLayout: loadDashboardLayout,
  lecturerOverview: loadLecturerOverview,
  cohortAnalytics: loadCohortAnalytics,
  performanceTrends: loadPerformanceTrends,
  academicIntegrity: loadAcademicIntegrity,
  moderationDashboard: loadModerationDashboard,
  adminDashboard: loadAdminDashboard,
  institutionalInsights: loadInstitutionalInsights,
  learningOutcomes: loadLearningOutcomes,
  studentGrades: loadStudentGrades,
  explainGrade: loadExplainGrade,
  improvementPlan: loadImprovementPlan,
  assignments: loadAssignments,
  assignmentDetail: loadAssignmentDetail,
  studentProfile: loadStudentProfile,
  accreditationDashboard: loadAccreditationDashboard,
  externalExaminerExport: loadExternalExaminerExport,
  settings: loadSettings,
} as const;

const routePreloadMap: Record<string, () => Promise<unknown>> = {
  "/auth": loadAuth,
  "/privacy": loadPrivacy,
  "/reset-password": loadResetPassword,
  "/dashboard": loadDashboardLayout,
  "/dashboard/cohort-analytics": loadCohortAnalytics,
  "/dashboard/performance": loadPerformanceTrends,
  "/dashboard/integrity": loadAcademicIntegrity,
  "/dashboard/moderation": loadModerationDashboard,
  "/dashboard/institutional": loadInstitutionalInsights,
  "/dashboard/accreditation": loadAccreditationDashboard,
  "/dashboard/external-examiner": loadExternalExaminerExport,
  "/dashboard/learning-outcomes": loadLearningOutcomes,
  "/dashboard/explain-grade": loadExplainGrade,
  "/dashboard/improvements": loadImprovementPlan,
  "/dashboard/assignments": loadAssignments,
  "/dashboard/settings": loadSettings,
};

const normalizeRoutePath = (value: string) => value.split("?")[0];

export const preloadRoute = (route: string) => {
  const normalizedRoute = normalizeRoutePath(route);
  const loader = routePreloadMap[normalizedRoute];

  if (!loader) return;

  void loader();
};

export const preloadCommonRoleRoutes = (role: AppRole | null | undefined) => {
  if (role === "lecturer") {
    preloadRoute("/dashboard/assignments");
    preloadRoute("/dashboard/moderation");
    preloadRoute("/dashboard/cohort-analytics");
    return;
  }

  if (role === "admin") {
    preloadRoute("/dashboard/institutional");
    preloadRoute("/dashboard/accreditation");
    preloadRoute("/dashboard/external-examiner");
    return;
  }

  if (role === "student") {
    preloadRoute("/dashboard/explain-grade");
    preloadRoute("/dashboard/improvements");
    preloadRoute("/dashboard/assignments");
  }
};
