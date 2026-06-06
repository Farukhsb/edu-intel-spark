import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { computeRisk } from "@/lib/studentRisk";
import { fetchLecturerPerformanceDataset } from "@/lib/data/student";
import { log } from "@/lib/logger";
import { parsePerformanceTrendsSearchState } from "@/lib/schemas/navigation";
import {
  DashboardEmptyState,
  DashboardErrorState,
  DashboardLoadingState,
} from "@/components/dashboard/PageStates";
import {
  buildPerformanceProjection,
  buildAtRiskStudentFilterIndex,
  EMPTY_GRADE_DIST,
  filterAtRiskStudents,
  getPerformanceReportingReadiness,
} from "@/lib/performanceAnalytics";
import {
  EarlySupportSignalsCard,
  FilteredInterventionBanner,
  PerformanceFiltersBar,
  StudentSupportSummaryCard,
} from "@/pages/dashboard/performance-trends/sections";

const AssessmentTrendsCard = lazy(() =>
  import("@/pages/dashboard/performance-trends/charts").then((module) => ({
    default: module.AssessmentTrendsCard,
  })),
);

const GradeDistributionCard = lazy(() =>
  import("@/pages/dashboard/performance-trends/charts").then((module) => ({
    default: module.GradeDistributionCard,
  })),
);

const PerformanceTrends = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const performanceSearchState = parsePerformanceTrendsSearchState(searchParams);
  const [moduleFilter, setModuleFilter] = useState("all");
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [alertsDismissed, setAlertsDismissed] = useState(false);
  const [assignments, setAssignments] = useState<
    { id: string; title: string; module_code: string | null }[]
  >([]);
  const [submissions, setSubmissions] = useState<
    {
      id: string;
      assignment_id: string;
      student_id: string | null;
      student_name: string | null;
      student_email: string | null;
      submitted_at: string;
    }[]
  >([]);
  const [grades, setGrades] = useState<
    { submission_id: string; ai_score: number | null; final_score: number | null }[]
  >([]);
  const { riskFilter, scoreBandFilter } = performanceSearchState;

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setLoadError(null);
      setAssignments([]);
      setSubmissions([]);
      setGrades([]);
      return;
    }

    const fetchLiveData = async () => {
      setLoadError(null);
      try {
        const dataset = await fetchLecturerPerformanceDataset(user.id);
        setAssignments(dataset.assignments);
        setSubmissions(dataset.submissions);
        setGrades(dataset.grades);
      } catch (error) {
        log.error("Failed to fetch performance data", error);
        setLoadError("Performance trends could not be loaded right now.");
        setAssignments([]);
        setSubmissions([]);
        setGrades([]);
      }

      setLoading(false);
    };

    void fetchLiveData();
  }, [user?.id, reloadKey]);

  const projection = useMemo(() => {
    if (assignments.length === 0) {
      return {
        modules: [],
        assessmentTrends: [],
        gradeDist: EMPTY_GRADE_DIST,
        atRiskStudents: [],
      };
    }

    return buildPerformanceProjection({
      assignments,
      submissions,
      grades,
      moduleFilter,
      computeRisk,
    });
  }, [assignments, submissions, grades, moduleFilter]);

  const atRiskStudentFilterIndex = useMemo(
    () => buildAtRiskStudentFilterIndex(projection.atRiskStudents),
    [projection.atRiskStudents],
  );

  useEffect(() => {
    if (alertsDismissed || projection.atRiskStudents.length === 0) return;

    const critical = projection.atRiskStudents.filter((student) => student.riskLevel === "critical");
    const high = projection.atRiskStudents.filter((student) => student.riskLevel === "high");

    if (critical.length > 0) {
      toast({
        variant: "destructive",
        title: `Critical At-Risk Student${critical.length > 1 ? "s" : ""}`,
        description: `${critical.map((student) => student.name).join(", ")} - immediate intervention recommended.`,
      });
    }

    if (high.length > 0) {
      toast({
        title: `${high.length} High-Risk Student${high.length > 1 ? "s" : ""} Detected`,
        description: `${high.map((student) => student.name).join(", ")} - review their trajectories.`,
      });
    }

    setAlertsDismissed(true);
  }, [alertsDismissed, projection.atRiskStudents, toast]);

  const filteredAtRiskStudents = useMemo(() => {
    return filterAtRiskStudents({
      students: projection.atRiskStudents,
      riskFilter,
      scoreBandFilter,
      index: atRiskStudentFilterIndex,
    });
  }, [projection.atRiskStudents, atRiskStudentFilterIndex, riskFilter, scoreBandFilter]);

  const reportingReadiness = useMemo(
    () =>
      getPerformanceReportingReadiness({
        assessmentTrends: projection.assessmentTrends,
        atRiskStudents: projection.atRiskStudents,
        gradeDist: projection.gradeDist,
      }),
    [projection.assessmentTrends, projection.atRiskStudents, projection.gradeDist],
  );

  const updateFilters = (nextRisk: string, nextScoreBand: string) => {
    const next = new URLSearchParams(searchParams);
    if (nextRisk === "all") next.delete("risk");
    else next.set("risk", nextRisk);

    if (nextScoreBand === "all") next.delete("scoreBand");
    else next.set("scoreBand", nextScoreBand);

    setSearchParams(next);
  };

  if (loading) {
    return <DashboardLoadingState />;
  }

  if (loadError) {
    return (
      <DashboardErrorState
        title="Performance trends unavailable"
        description={loadError}
        action={
          <Button
            variant="outline"
            onClick={() => {
              setLoading(true);
              setLoadError(null);
              setAlertsDismissed(false);
              setReloadKey((current) => current + 1);
            }}
          >
            Try again
          </Button>
        }
      />
    );
  }

  const noData = projection.assessmentTrends.length === 0 && projection.gradeDist.every((entry) => entry.count === 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="text-base">Teaching Focus</CardTitle>
          <CardDescription>
            A compact reading of which performance signal is most likely to need teaching attention next.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current position</p>
            <p className="mt-2 text-sm font-semibold">{reportingReadiness.postureLabel}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Based on current risk, failing-band, and assessment-average signals in this performance view.
            </p>
          </div>
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What needs attention</p>
            <p className="mt-2 text-sm font-semibold">{reportingReadiness.likelyChallenge}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This is the signal most likely to require either lecturer intervention or a clear explanation in review.
            </p>
          </div>
          <div className="rounded-lg border bg-background/70 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Next step</p>
            <p className="mt-2 text-sm font-semibold">{reportingReadiness.bestNextAction}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use this to decide whether to act on student support first or review assessment performance first.
            </p>
          </div>
        </CardContent>
      </Card>

      <PerformanceFiltersBar
        modules={projection.modules}
        moduleFilter={moduleFilter}
        riskFilter={riskFilter}
        scoreBandFilter={scoreBandFilter}
        atRiskCount={projection.atRiskStudents.length}
        onModuleFilterChange={setModuleFilter}
        onRiskFilterChange={(value) => updateFilters(value, scoreBandFilter)}
        onScoreBandFilterChange={(value) => updateFilters(riskFilter, value)}
      />

      {(riskFilter !== "all" || scoreBandFilter !== "all") && (
        <FilteredInterventionBanner count={filteredAtRiskStudents.length} onClear={() => updateFilters("all", "all")} />
      )}

      {noData ? (
        <DashboardEmptyState
          title="No graded submissions yet"
          description="Performance trends will appear once assignments are graded."
        />
      ) : (
        <>
          {projection.assessmentTrends.length > 0 && (
            <Suspense fallback={<DashboardLoadingState testId="performance-trends-chart-loading" />}>
              <AssessmentTrendsCard assessmentTrends={projection.assessmentTrends} />
            </Suspense>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Suspense fallback={<DashboardLoadingState testId="performance-grade-distribution-loading" />}>
              <GradeDistributionCard gradeDist={projection.gradeDist} />
            </Suspense>
            <StudentSupportSummaryCard
              filteredStudents={filteredAtRiskStudents}
              allAtRiskCount={projection.atRiskStudents.length}
            />
          </div>

          <EarlySupportSignalsCard
            students={filteredAtRiskStudents}
            allAtRiskCount={projection.atRiskStudents.length}
            expandedStudent={expandedStudent}
            onToggleStudent={(studentId) => setExpandedStudent(studentId || null)}
            onOpenStudentPlan={(studentId) => navigate(`/dashboard/student/${encodeURIComponent(studentId)}`)}
            onContactStudent={(student) => {
              window.location.href = `mailto:${student.email}?subject=Academic Support - Performance Check-in&body=Dear ${student.name},%0A%0AI would like to schedule a meeting to discuss your academic progress and explore support options available to you.%0A%0ABest regards`;
            }}
          />
        </>
      )}
    </div>
  );
};

export default PerformanceTrends;
