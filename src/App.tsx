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

const queryClient = new QueryClient();

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

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isDemo, profileError, signOut, resendVerification } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading your account...</p>
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="flex h-screen items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <p className="text-destructive font-medium">{profileError}</p>
          <button
            onClick={() => { signOut(); }}
            className="text-sm text-primary hover:underline"
          >
            Sign out and try again
          </button>
        </div>
      </div>
    );
  }

  if (!user && !isDemo) return <Navigate to="/auth" replace />;

  // Email verification check (skip for demo)
  if (user && !isDemo && !user.emailVerified) {
    return (
      <div className="flex h-screen items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="h-12 w-12 mx-auto rounded-full bg-warning/10 flex items-center justify-center">
            <span className="text-2xl">📧</span>
          </div>
          <h2 className="text-lg font-semibold">Verify your email</h2>
          <p className="text-sm text-muted-foreground">
            We sent a verification link to <strong>{user.email}</strong>. Please check your inbox and click the link to continue.
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={async () => { await resendVerification(); window.location.reload(); }}
              className="text-sm text-primary hover:underline"
            >
              Resend verification email
            </button>
            <span className="text-muted-foreground">·</span>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-primary hover:underline"
            >
              I've verified, refresh
            </button>
          </div>
          <button
            onClick={() => { signOut(); }}
            className="text-xs text-muted-foreground hover:underline"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const DashboardRouter = () => {
  const { role } = useAuth();
  if (role === "lecturer") return <LecturerOverview />;
  return <StudentGrades />;
};

const DashboardRoute = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <DashboardLayout>
      <Suspense fallback={<DashboardSkeleton />}>
        {children}
      </Suspense>
    </DashboardLayout>
  </ProtectedRoute>
);

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
            <Route path="/dashboard" element={<DashboardRoute><DashboardRouter /></DashboardRoute>} />
            <Route path="/dashboard/cohort-analytics" element={<DashboardRoute><CohortAnalytics /></DashboardRoute>} />
            <Route path="/dashboard/performance" element={<DashboardRoute><PerformanceTrends /></DashboardRoute>} />
            <Route path="/dashboard/integrity" element={<DashboardRoute><AcademicIntegrity /></DashboardRoute>} />
            <Route path="/dashboard/institutional" element={<DashboardRoute><InstitutionalInsights /></DashboardRoute>} />
            <Route path="/dashboard/learning-outcomes" element={<DashboardRoute><LearningOutcomes /></DashboardRoute>} />
            <Route path="/dashboard/explain-grade" element={<DashboardRoute><ExplainGrade /></DashboardRoute>} />
            <Route path="/dashboard/improvements" element={<DashboardRoute><ImprovementPlan /></DashboardRoute>} />
            <Route path="/dashboard/assignments" element={<DashboardRoute><Assignments /></DashboardRoute>} />
            <Route path="/dashboard/assignments/:id" element={<DashboardRoute><AssignmentDetail /></DashboardRoute>} />
            <Route path="/dashboard/student/:studentId" element={<DashboardRoute><StudentProfile /></DashboardRoute>} />
            <Route path="/install" element={<Install />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
