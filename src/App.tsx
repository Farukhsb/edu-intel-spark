import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { NetworkStatus } from "@/components/NetworkStatus";
import { Suspense, lazy } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getForcedPasswordChangeRoute, getPasswordChangeRedirectPath } from "@/lib/passwordChangeRouting";
import { isAdminRole, isLecturerEquivalentRole } from "@/lib/roles";

import Index from "./pages/Index";
import { AppErrorBoundary } from "./components/AppErrorBoundary";

const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Install = lazy(() => import("./pages/Install"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ForcePasswordChange = lazy(() => import("./pages/ForcePasswordChange"));
const DashboardLayout = lazy(() => import("./components/DashboardLayout").then((module) => ({ default: module.DashboardLayout })));
const LecturerOverview = lazy(() => import("./pages/dashboard/LecturerOverview"));
const CohortAnalytics = lazy(() => import("./pages/dashboard/CohortAnalytics"));
const PerformanceTrends = lazy(() => import("./pages/dashboard/PerformanceTrends"));
const AcademicIntegrity = lazy(() => import("./pages/dashboard/AcademicIntegrity"));
const ModerationDashboard = lazy(() => import("./pages/dashboard/ModerationDashboard"));
const AdminDashboard = lazy(() => import("./pages/dashboard/AdminDashboard"));
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

const PasswordChangeGate = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const { user, loading, isDemo, mustChangePassword } = useAuth();

  if (!loading) {
    const redirectPath = getPasswordChangeRedirectPath({
      isAuthenticated: Boolean(user),
      isDemo,
      mustChangePassword,
      pathname: location.pathname,
    });

    if (redirectPath) {
      return <Navigate to={redirectPath} replace />;
    }
  }

  return <>{children}</>;
};

const DashboardRouter = () => {
  const { role } = useAuth();
  if (isAdminRole(role)) return <AdminDashboard />;
  if (role === "lecturer") return <LecturerOverview />;
  return <StudentGrades />;
};

const DashboardRoute = ({ children, allowedRole }: { children: React.ReactNode; allowedRole?: "lecturer" | "student" }) => {
  const location = useLocation();

  return (
    <ProtectedRoute>
      <RoleGate allowedRole={allowedRole}>
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardLayout>
            <AppErrorBoundary title="Dashboard page failed to load" resetKey={location.pathname}>
              <Suspense fallback={<DashboardSkeleton />}>{children}</Suspense>
            </AppErrorBoundary>
          </DashboardLayout>
        </Suspense>
      </RoleGate>
    </ProtectedRoute>
  );
};

const RoleGate = ({ children, allowedRole }: { children: React.ReactNode; allowedRole?: "lecturer" | "student" }) => {
  const { role } = useAuth();
  const resolvedRole = isLecturerEquivalentRole(role) ? "lecturer" : role;
  if (allowedRole && resolvedRole && resolvedRole !== allowedRole) {
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
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <PasswordChangeGate>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route
                path="/auth"
                element={
                  <Suspense fallback={<PageSkeleton />}>
                    <Auth />
                  </Suspense>
                }
              />
              <Route
                path="/reset-password"
                element={
                  <Suspense fallback={<PageSkeleton />}>
                    <ResetPassword />
                  </Suspense>
                }
              />
              <Route
                path={getForcedPasswordChangeRoute()}
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageSkeleton />}>
                      <ForcePasswordChange />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route path="/dashboard" element={<DashboardRoute><DashboardRouter /></DashboardRoute>} />
              <Route path="/dashboard/cohort-analytics" element={<DashboardRoute allowedRole="lecturer"><CohortAnalytics /></DashboardRoute>} />
              <Route path="/dashboard/performance" element={<DashboardRoute allowedRole="lecturer"><PerformanceTrends /></DashboardRoute>} />
              <Route path="/dashboard/integrity" element={<DashboardRoute allowedRole="lecturer"><AcademicIntegrity /></DashboardRoute>} />
              <Route path="/dashboard/moderation" element={<DashboardRoute allowedRole="lecturer"><ModerationDashboard /></DashboardRoute>} />
              <Route path="/dashboard/institutional" element={<DashboardRoute allowedRole="lecturer"><InstitutionalInsights /></DashboardRoute>} />
              <Route path="/dashboard/accreditation" element={<DashboardRoute allowedRole="lecturer"><AccreditationDashboard /></DashboardRoute>} />
              <Route path="/dashboard/external-examiner" element={<DashboardRoute allowedRole="lecturer"><ExternalExaminerExport /></DashboardRoute>} />
              <Route path="/dashboard/learning-outcomes" element={<DashboardRoute allowedRole="lecturer"><LearningOutcomes /></DashboardRoute>} />
              <Route path="/dashboard/explain-grade" element={<DashboardRoute allowedRole="student"><ExplainGrade /></DashboardRoute>} />
              <Route path="/dashboard/improvements" element={<DashboardRoute allowedRole="student"><ImprovementPlan /></DashboardRoute>} />
              <Route path="/dashboard/assignments" element={<DashboardRoute><Assignments /></DashboardRoute>} />
              <Route path="/dashboard/assignments/:id" element={<DashboardRoute><AssignmentDetail /></DashboardRoute>} />
              <Route path="/dashboard/student/:studentId" element={<DashboardRoute allowedRole="lecturer"><StudentProfile /></DashboardRoute>} />
              <Route path="/dashboard/settings" element={<DashboardRoute><Settings /></DashboardRoute>} />
              <Route
                path="/install"
                element={
                  <Suspense fallback={<PageSkeleton />}>
                    <Install />
                  </Suspense>
                }
              />
              <Route
                path="*"
                element={
                  <Suspense fallback={<PageSkeleton />}>
                    <NotFound />
                  </Suspense>
                }
              />
            </Routes>
          </PasswordChangeGate>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
