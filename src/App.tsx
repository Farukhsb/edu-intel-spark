import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Install from "./pages/Install";
import { DashboardLayout } from "./components/DashboardLayout";

import LecturerOverview from "./pages/dashboard/LecturerOverview";
import CohortAnalytics from "./pages/dashboard/CohortAnalytics";
import PerformanceTrends from "./pages/dashboard/PerformanceTrends";
import AcademicIntegrity from "./pages/dashboard/AcademicIntegrity";
import InstitutionalInsights from "./pages/dashboard/InstitutionalInsights";
import StudentGrades from "./pages/dashboard/StudentGrades";
import ExplainGrade from "./pages/dashboard/ExplainGrade";
import ImprovementPlan from "./pages/dashboard/ImprovementPlan";
import Assignments from "./pages/dashboard/Assignments";
import AssignmentDetail from "./pages/dashboard/AssignmentDetail";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!session) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const DashboardRouter = () => {
  const { role } = useAuth();
  if (role === "lecturer") return <LecturerOverview />;
  return <StudentGrades />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <DashboardRouter />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/cohort-analytics"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <CohortAnalytics />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/performance"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <PerformanceTrends />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/integrity"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <AcademicIntegrity />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/institutional"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <InstitutionalInsights />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/explain-grade"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ExplainGrade />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/improvements"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ImprovementPlan />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/assignments"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Assignments />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/assignments/:id"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <AssignmentDetail />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route path="/install" element={<Install />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
