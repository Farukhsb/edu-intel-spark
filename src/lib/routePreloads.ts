import type { AppRole } from "@/lib/roles";
import type { ComponentType } from "react";

type RouteLoader = () => Promise<{ default: ComponentType<any> }>;

const routeDefinitions = {
  auth: {
    loader: () => import("@/pages/Auth"),
    paths: ["/auth"],
  },
  notFound: {
    loader: () => import("@/pages/NotFound"),
    paths: [],
  },
  privacy: {
    loader: () => import("@/pages/Privacy"),
    paths: ["/privacy"],
  },
  demo: {
    loader: () => import("@/pages/Demo"),
    paths: ["/demo"],
  },
  terms: {
    loader: () => import("@/pages/Terms"),
    paths: ["/terms"],
  },
  resetPassword: {
    loader: () => import("@/pages/ResetPassword"),
    paths: ["/reset-password"],
  },
  forcePasswordChange: {
    loader: () => import("@/pages/ForcePasswordChange"),
    paths: [],
  },
  dashboardLayout: {
    loader: () =>
      import("@/components/DashboardLayout").then((module) => ({ default: module.DashboardLayout })),
    paths: ["/dashboard"],
  },
  demoDashboardLayout: {
    loader: () =>
      import("@/components/DemoDashboardLayout").then((module) => ({ default: module.DemoDashboardLayout })),
    paths: ["/demo/dashboard"],
  },
  lecturerOverview: {
    loader: () => import("@/pages/dashboard/LecturerOverview"),
    paths: [],
  },
  cohortAnalytics: {
    loader: () => import("@/pages/dashboard/CohortAnalytics"),
    paths: ["/dashboard/cohort-analytics"],
  },
  performanceTrends: {
    loader: () => import("@/pages/dashboard/PerformanceTrends"),
    paths: ["/dashboard/performance"],
  },
  demoPerformanceTrends: {
    loader: () => import("@/pages/dashboard/DemoPerformanceTrends"),
    paths: ["/demo/dashboard/performance"],
  },
  academicIntegrity: {
    loader: () => import("@/pages/dashboard/AcademicIntegrity"),
    paths: ["/dashboard/integrity"],
  },
  demoAcademicIntegrity: {
    loader: () => import("@/pages/dashboard/DemoAcademicIntegrity"),
    paths: ["/demo/dashboard/integrity"],
  },
  demoAccreditationDashboard: {
    loader: () => import("@/pages/dashboard/DemoAccreditationDashboard"),
    paths: ["/demo/dashboard/accreditation"],
  },
  demoModerationDashboard: {
    loader: () => import("@/pages/dashboard/DemoModerationDashboard"),
    paths: ["/demo/dashboard/moderation"],
  },
  demoExternalExaminerExport: {
    loader: () => import("@/pages/dashboard/DemoExternalExaminerExport"),
    paths: ["/demo/dashboard/external-examiner"],
  },
  moderationDashboard: {
    loader: () => import("@/pages/dashboard/ModerationDashboard"),
    paths: ["/dashboard/moderation"],
  },
  adminDashboard: {
    loader: () => import("@/pages/dashboard/AdminDashboard"),
    paths: [],
  },
  institutionalInsights: {
    loader: () => import("@/pages/dashboard/InstitutionalInsights"),
    paths: ["/dashboard/institutional"],
  },
  learningOutcomes: {
    loader: () => import("@/pages/dashboard/LearningOutcomes"),
    paths: ["/dashboard/learning-outcomes"],
  },
  demoLearningOutcomes: {
    loader: () => import("@/pages/dashboard/DemoLearningOutcomes"),
    paths: ["/demo/dashboard/learning-outcomes"],
  },
  studentGrades: {
    loader: () => import("@/pages/dashboard/StudentGrades"),
    paths: [],
  },
  demoStudentGrades: {
    loader: () => import("@/pages/dashboard/DemoStudentGrades"),
    paths: [],
  },
  improvementPlan: {
    loader: () => import("@/pages/dashboard/ImprovementPlan"),
    paths: ["/dashboard/improvements"],
  },
  assignments: {
    loader: () => import("@/pages/dashboard/Assignments"),
    paths: ["/dashboard/assignments"],
  },
  assignmentDetail: {
    loader: () => import("@/pages/dashboard/AssignmentDetail"),
    paths: [],
  },
  studentProfile: {
    loader: () => import("@/pages/dashboard/StudentProfile"),
    paths: [],
  },
  accreditationDashboard: {
    loader: () => import("@/pages/dashboard/AccreditationDashboard"),
    paths: ["/dashboard/accreditation"],
  },
  externalExaminerExport: {
    loader: () => import("@/pages/dashboard/ExternalExaminerExport"),
    paths: ["/dashboard/external-examiner"],
  },
  settings: {
    loader: () => import("@/pages/dashboard/Settings"),
    paths: ["/dashboard/settings"],
  },
} as const satisfies Record<string, { loader: RouteLoader; paths: readonly string[] }>;

export const routeLoaders = Object.fromEntries(
  Object.entries(routeDefinitions).map(([key, definition]) => [key, definition.loader]),
) as {
  [Key in keyof typeof routeDefinitions]: (typeof routeDefinitions)[Key]["loader"];
};

const routePreloadMap = Object.fromEntries(
  Object.values(routeDefinitions).flatMap((definition) =>
    definition.paths.map((path) => [path, definition.loader] as const),
  ),
) as Record<string, RouteLoader>;

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
    preloadRoute("/dashboard/assignments");
  }
};
