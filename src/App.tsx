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

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
});

const DashboardSkeleton = () => (
  <div className="space-y-4 p-4">
    <Skeleton className="h-8 w-48" />
    <div className="grid gap-4 md:grid-cols-3">
      <Skeleton className="h-32" />
      <Skeleton className="h-32" />
      <Skeleton className="h-32" />
    </div>
    <Skeleton className="h-64" />
  </div>
);

const PageSkeleton = () => (
  <div className="flex min-h-screen items-center justify-center bg-background p-4">
    <div className="w-full max-w-md space-y-4">
      <Skeleton className="h-10 w-28" />
      <Skeleton className="h-80 w-full" />
    </div>
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isDemo, profileError, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading your account...</p>
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="flex h-screen items-center justify-center p-4">
        <div className="max-w-md space-y-4 text-center">
          <p className="font-medium text-destructive">{profileError}</p>
          <button
            onClick={() => {
              void signOut();
            }}
            className="text-sm text-primary hover:underline"
          >
            Sign out and try again
          </button>
        </div>
      </div>
    );
  }

  if (!user && !isDemo) return <Navigate to="/auth" replace />;

  return <>{children}</>;
};

const DashboardRouter = () => {
  const { role } = useAuth();
  if (role === "lecturer") return <LecturerOverview />;
  return <StudentGrades />;
};

const DashboardRoute = ({ children, allowedRole }: { children: React.ReactNode; allowedRole?: "lecturer" | "student" }) => (
  <ProtectedRoute>
    <RoleGate allowedRole={allowedRole}>
      <DashboardLayout>
        <Suspense fallback={<DashboardSkeleton />}>{children}</Suspense>
      </DashboardLayout>
    </RoleGate>
  </ProtectedRoute>
);

const RoleGate = ({ children, allowedRole }: { children: React.ReactNode; allowedRole?: "lecturer" | "student" }) => {
  const { role } = useAuth();
  if (allowedRole && role && role !== allowedRole) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <NetworkStatus />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/reset-password"
              element={
                <Suspense fallback={<PageSkeleton />}>
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
