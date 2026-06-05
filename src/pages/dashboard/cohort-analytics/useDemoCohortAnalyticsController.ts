import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { buildAbsoluteAppUrl, copyTextToClipboard } from "@/lib/clipboard";
import { getCohortReportingReadiness, type CohortRecommendation } from "@/lib/cohortRecommendations";
import { toast } from "sonner";
import { DEMO_ASSIGNMENTS, DEMO_RECOMMENDATIONS } from "./demoData";
import {
  buildGradeDistribution,
  getRecommendationRoute,
} from "./useCohortAnalyticsController";
import type { AssignmentAnalytics, CohortAtRiskStudentSummary } from "./types";

const getDemoRecommendationRoute = (recommendation: CohortRecommendation) =>
  getRecommendationRoute(recommendation).replace("/dashboard", "/demo/dashboard");

export const useDemoCohortAnalyticsController = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [moduleFilter, setModuleFilter] = useState("all");
  const [modules, setModules] = useState<AssignmentAnalytics[]>(DEMO_ASSIGNMENTS);
  const [recommendations, setRecommendations] = useState<CohortRecommendation[]>(DEMO_RECOMMENDATIONS);
  const [topAtRiskStudents] = useState<CohortAtRiskStudentSummary[]>([
    {
      studentId: "demo-student-1",
      name: "Ada Lovelace",
      riskLevel: "critical",
      riskScore: 88,
      trend: "declining",
      signal: "Average below 40%",
      recommendation: "Urgent: schedule a 1-on-1 meeting to discuss grade trajectory.",
      predictedNext: 34,
    },
    {
      studentId: "demo-student-2",
      name: "Alan Turing",
      riskLevel: "high",
      riskScore: 73,
      trend: "volatile",
      signal: "Gradual grade decline",
      recommendation: "Schedule a check-in to review study strategies and agree short-term goals.",
      predictedNext: 41,
    },
  ]);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    if (moduleFilter !== "all" || modules.length === 0) return;

    const targetId = searchParams.get("ltiContextId") || searchParams.get("ltiResourceLinkId");
    if (!targetId) return;

    const matchedModule = modules.find(
      (module) =>
        module.id === targetId ||
        (module.moduleCode && module.moduleCode === targetId),
    );

    if (matchedModule) {
      setModuleFilter(matchedModule.id);
    }
  }, [moduleFilter, modules, searchParams]);

  const gradeDistChart = useMemo(() => {
    return buildGradeDistribution(
      moduleFilter === "all" ? [72, 69, 65, 61, 58, 54, 49, 43, 35] : [66, 61, 58, 49, 45, 39, 32],
    );
  }, [moduleFilter]);

  const filteredModules = useMemo(
    () => (moduleFilter === "all" ? modules : modules.filter((module) => module.id === moduleFilter)),
    [moduleFilter, modules],
  );

  const visibleRecommendations = useMemo(
    () =>
      recommendations.filter(
        (recommendation) =>
          recommendation.status !== "dismissed" &&
          (moduleFilter === "all" || !recommendation.assignmentId || recommendation.assignmentId === moduleFilter),
      ),
    [moduleFilter, recommendations],
  );

  const reportingReadiness = useMemo(
    () =>
      getCohortReportingReadiness({
        assignments: filteredModules,
        recommendations: visibleRecommendations,
      }),
    [filteredModules, visibleRecommendations],
  );

  const updateRecommendationStatus = (
    recommendation: CohortRecommendation,
    nextStatus: CohortRecommendation["status"],
  ) => {
    setRecommendations((current) =>
      current.map((item) => (item.id === recommendation.id ? { ...item, status: nextStatus } : item)),
    );
  };

  const handleReview = async (recommendation: CohortRecommendation) => {
    setActingId(recommendation.id);
    updateRecommendationStatus(recommendation, "reviewed");
    setActingId(null);
    navigate(getDemoRecommendationRoute(recommendation));
  };

  const handleDismiss = async (recommendation: CohortRecommendation) => {
    setActingId(recommendation.id);
    updateRecommendationStatus(recommendation, "dismissed");
    setActingId(null);
  };

  const handleCreateIntervention = async (recommendation: CohortRecommendation) => {
    setActingId(recommendation.id);
    const targetIds = recommendation.evidence.affectedStudentIds || [];

    if (recommendation.status === "actioned") {
      setActingId(null);
      navigate(getDemoRecommendationRoute(recommendation));
      return;
    }

    updateRecommendationStatus(recommendation, "actioned");
    setActingId(null);

    if (targetIds.length > 0) {
      toast.success("Intervention actions created for the affected students.");
      navigate("/demo/dashboard/performance?risk=high-plus");
      return;
    }

    toast.success("Recommendation marked for intervention planning.");
    navigate(getDemoRecommendationRoute(recommendation));
  };

  const handleCopyWorkflowLink = async (recommendation: CohortRecommendation) => {
    const copied = await copyTextToClipboard(buildAbsoluteAppUrl(getDemoRecommendationRoute(recommendation)));
    if (copied) {
      toast.success("Workflow link copied.");
      return;
    }

    toast.error("Could not copy the workflow link.");
  };

  return {
    loading: false,
    loadError: null,
    modules,
    moduleFilter,
    setModuleFilter,
    gradeDistChart,
    filteredModules,
    visibleRecommendations,
    reportingReadiness,
    topAtRiskStudents,
    actingId,
    handleReview,
    handleDismiss,
    handleCreateIntervention,
    handleCopyWorkflowLink,
    reload: () => {
      setModuleFilter("all");
      setModules([...DEMO_ASSIGNMENTS]);
      setRecommendations([...DEMO_RECOMMENDATIONS]);
      setActingId(null);
    },
  };
};
