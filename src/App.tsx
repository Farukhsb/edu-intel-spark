import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { NetworkStatus } from "@/components/NetworkStatus";

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
import LearningOutcomes from "./pages/dashboard/LearningOutcomes";
import StudentGrades from "./pages/dashboard/StudentGrades";
import ExplainGrade from "./pages/dashboard/ExplainGrade";
import ImprovementPlan from "./pages/dashboard/ImprovementPlan";
import Assignments from "./pages/dashboard/Assignments";
import AssignmentDetail from "./pages/dashboard/AssignmentDetail";
import StudentProfile from "./pages/dashboard/StudentProfile";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isDemo } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!user && !isDemo) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const DashboardRouter = () => {
  const { role } = useAuth();
  if (role === "lecturer") return <LecturerOverview />;
  return <StudentGrades />;
};

const DashboardRoute = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <DashboardLayout>{children}</DashboardLayout>
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
