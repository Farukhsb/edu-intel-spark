import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { NetworkStatus } from "@/components/NetworkStatus";
import { Suspense, lazy } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RouteMetadata } from "@/components/RouteMetadata";
import { getForcedPasswordChangeRoute, getPasswordChangeRedirectPath } from "@/lib/passwordChangeRouting";
import type { AppRole } from "@/lib/roles";
import { isAdminRole, isLecturerEquivalentRole } from "@/lib/roles";
import { routeLoaders } from "@/lib/routePreloads";

import Index from "./pages/Index";
import { AppErrorBoundary } from "./components/AppErrorBoundary";

const Auth = lazy(routeLoaders.auth);
const NotFound = lazy(routeLoaders.notFound);
const Privacy = lazy(routeLoaders.privacy);
const Terms = lazy(routeLoaders.terms);
const ResetPassword = lazy(routeLoaders.resetPassword);
const ForcePasswordChange = lazy(routeLoaders.forcePasswordChange);
const DashboardLayout = lazy(routeLoaders.dashboardLayout);
const LecturerOverview = lazy(routeLoaders.lecturerOverview);
const CohortAnalytics = lazy(routeLoaders.cohortAnalytics);
const PerformanceTrends = lazy(routeLoaders.performanceTrends);
const AcademicIntegrity = lazy(routeLoaders.academicIntegrity);
const ModerationDashboard = lazy(routeLoaders.moderationDashboard);
const AdminDashboard = lazy(routeLoaders.adminDashboard);
const InstitutionalInsights = lazy(routeLoaders.institutionalInsights);
const LearningOutcomes = lazy(routeLoaders.learningOutcomes);
const StudentGrades = lazy(routeLoaders.studentGrades);
const ExplainGrade = lazy(routeLoaders.explainGrade);
const Assignments = lazy(routeLoaders.assignments);
const AssignmentDetail = lazy(routeLoaders.assignmentDetail);
const StudentProfile = lazy(routeLoaders.studentProfile);
const AccreditationDashboard = lazy(routeLoaders.accreditationDashboard);
const ExternalExaminerExport = lazy(routeLoaders.externalExaminerExport);
const Settings = lazy(routeLoaders.settings);

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

const DashboardRoute = ({ children, allowedRole }: { children: React.ReactNode; allowedRole?: AppRole }) => {
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

const AccessDeniedPage = () => (
  <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
    <Card className="w-full max-w-lg shadow-sm">
      <CardHeader className="space-y-2 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Access denied</p>
        <CardTitle className="text-2xl">You don&apos;t have access to this area.</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          This page is limited to a different role. Return to your dashboard to continue with the tools available to
          your account.
        </p>
        <div className="flex justify-center">
          <Button asChild>
            <Link to="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
);

export const RoleGate = ({ children, allowedRole }: { children: React.ReactNode; allowedRole?: AppRole }) => {
  const { role } = useAuth();
  const resolvedRole = allowedRole === "lecturer" && isLecturerEquivalentRole(role) ? "lecturer" : role;
  if (allowedRole && resolvedRole && resolvedRole !== allowedRole) {
    return <AccessDeniedPage />;
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
        <RouteMetadata />
        <AuthProvider>
          <PasswordChangeGate>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route
                path="/privacy"
                element={
                  <Suspense fallback={<PageSkeleton />}>
                    <Privacy />
                  </Suspense>
                }
              />
              <Route
                path="/terms"
                element={
                  <Suspense fallback={<PageSkeleton />}>
                    <Terms />
                  </Suspense>
                }
              />
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
              <Route path="/dashboard/institutional" element={<DashboardRoute allowedRole="admin"><InstitutionalInsights /></DashboardRoute>} />
              <Route path="/dashboard/accreditation" element={<DashboardRoute allowedRole="admin"><AccreditationDashboard /></DashboardRoute>} />
              <Route path="/dashboard/external-examiner" element={<DashboardRoute allowedRole="admin"><ExternalExaminerExport /></DashboardRoute>} />
              <Route path="/dashboard/learning-outcomes" element={<DashboardRoute allowedRole="lecturer"><LearningOutcomes /></DashboardRoute>} />
              <Route path="/dashboard/explain-grade" element={<DashboardRoute allowedRole="student"><ExplainGrade /></DashboardRoute>} />
              <Route
                path="/dashboard/improvements"
                element={
                  <DashboardRoute allowedRole="student">
                    <Navigate to="/dashboard" replace />
                  </DashboardRoute>
                }
              />
              <Route path="/dashboard/assignments" element={<DashboardRoute><Assignments /></DashboardRoute>} />
              <Route path="/dashboard/assignments/:id" element={<DashboardRoute><AssignmentDetail /></DashboardRoute>} />
              <Route path="/dashboard/student/:studentId" element={<DashboardRoute allowedRole="lecturer"><StudentProfile /></DashboardRoute>} />
              <Route path="/dashboard/settings" element={<DashboardRoute><Settings /></DashboardRoute>} />
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
