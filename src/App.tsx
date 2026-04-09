import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { NetworkStatus } from "@/components/NetworkStatus";
import { Suspense, lazy } from "react";
import { Skeleton } from "@/components/ui/skeleton";

import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Install from "./pages/Install";
import { DashboardLayout } from "./components/DashboardLayout";

// Lazy-loaded dashboard pages
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const LecturerOverview = lazy(() => import("./pages/dashboard/LecturerOverview"));
const CohortAnalytics = lazy(() => import("./pages/dashboard/CohortAnalytics"));
const PerformanceTrends = lazy(() => import("./pages/dashboard/PerformanceTrends"));
const AcademicIntegrity = lazy(() => import("./pages/dashboard/AcademicIntegrity"));
const InstitutionalInsights = lazy(() => import("./pages/dashboard/InstitutionalInsights"));
const LearningOutcomes = lazy(() => import("./pages/dashboard/LearningOutcomes"));
const StudentGrades = lazy(() => import("./pages/dashboard/StudentGrades"));
const ExplainGrade = lazy(() => import("./pages/dashboard/ExplainGrade"));
const ImprovementPlan = lazy(() => import("./pages/dashboard/ImprovementPlan"));
const Assignments = lazy(() => import("./pages/dashboard/Assignments"));
const AssignmentDetail = lazy(() => import("./pages/dashboard/AssignmentDetail"));
const StudentProfile = lazy(() => import("./pages/dashboard/StudentProfile"));
const AccreditationDashboard = lazy(() => import("./pages/dashboard/AccreditationDashboard"));
const ExternalExaminerExport = lazy(() => import("./pages/dashboard/ExternalExaminerExport"));
const Settings = lazy(() => import("./pages/dashboard/Settings"));
...
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/reset-password"
              element={
                <Suspense fallback={<DashboardSkeleton />}>
                  <ResetPassword />
                </Suspense>
              }
            />
            <Route path="/dashboard" element={<DashboardRoute><DashboardRouter /></DashboardRoute>} />
            <Route path="/dashboard/cohort-analytics" element={<DashboardRoute><CohortAnalytics /></DashboardRoute>} />
            <Route path="/dashboard/performance" element={<DashboardRoute><PerformanceTrends /></DashboardRoute>} />
            <Route path="/dashboard/integrity" element={<DashboardRoute><AcademicIntegrity /></DashboardRoute>} />
            <Route path="/dashboard/institutional" element={<DashboardRoute><InstitutionalInsights /></DashboardRoute>} />
            <Route path="/dashboard/accreditation" element={<DashboardRoute><AccreditationDashboard /></DashboardRoute>} />
            <Route path="/dashboard/external-examiner" element={<DashboardRoute><ExternalExaminerExport /></DashboardRoute>} />
            <Route path="/dashboard/learning-outcomes" element={<DashboardRoute><LearningOutcomes /></DashboardRoute>} />
            <Route path="/dashboard/explain-grade" element={<DashboardRoute><ExplainGrade /></DashboardRoute>} />
            <Route path="/dashboard/improvements" element={<DashboardRoute><ImprovementPlan /></DashboardRoute>} />
            <Route path="/dashboard/assignments" element={<DashboardRoute><Assignments /></DashboardRoute>} />
            <Route path="/dashboard/assignments/:id" element={<DashboardRoute><AssignmentDetail /></DashboardRoute>} />
            <Route path="/dashboard/student/:studentId" element={<DashboardRoute><StudentProfile /></DashboardRoute>} />
            <Route path="/dashboard/settings" element={<DashboardRoute><Settings /></DashboardRoute>} />
            <Route path="/install" element={<Install />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
