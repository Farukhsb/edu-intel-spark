import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate, useSearchParams } from "react-router-dom";
import { type AtRiskStudent, computeRisk } from "@/lib/studentRisk";
import { preloadPerformanceTrendsCharts } from "@/lib/routePreloads";
import { parsePerformanceTrendsSearchState } from "@/lib/schemas/navigation";
import { DashboardDemoBanner, DashboardEmptyState, DashboardLoadingState } from "@/components/dashboard/PageStates";
import {
  buildAtRiskStudentFilterIndex,
  buildGradeDistribution,
  filterAtRiskStudents,
  getPerformanceReportingReadiness,
} from "@/lib/performanceAnalytics";
import {
  EarlySupportSignalsCard,
  FilteredInterventionBanner,
  PerformanceFiltersBar,
  StudentSupportSummaryCard,
} from "@/pages/dashboard/performance-trends/sections";
import {
  DEMO_ASSESSMENT_TRENDS,
  DEMO_GRADE_SCORES,
  DEMO_TRAJECTORIES,
} from "@/pages/dashboard/performance-trends/demoData";

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

const DemoPerformanceTrends = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const performanceSearchState = parsePerformanceTrendsSearchState(searchParams);
  const [moduleFilter, setModuleFilter] = useState("all");
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  const { riskFilter, scoreBandFilter } = performanceSearchState;

  useEffect(() => {
    preloadPerformanceTrendsCharts();
  }, []);

  const modules = useMemo(
    () => Array.from(new Set(DEMO_ASSESSMENT_TRENDS.map((entry) => entry.module))),
    [],
  );

  const assessmentTrends = useMemo(
    () =>
      (moduleFilter === "all"
        ? DEMO_ASSESSMENT_TRENDS
        : DEMO_ASSESSMENT_TRENDS.filter((entry) => entry.module === moduleFilter)
      ).map(({ name, avgGrade, participation }) => ({
        name,
        avgGrade,
        participation,
      })),
    [moduleFilter],
  );

  const gradeDist = useMemo(() => {
    const filteredScores = DEMO_GRADE_SCORES.filter((entry) => moduleFilter === "all" || entry.module === moduleFilter).map(
      (entry) => entry.score,
    );
    return buildGradeDistribution(filteredScores);
  }, [moduleFilter]);

  const atRiskStudents = useMemo<AtRiskStudent[]>(() => {
    return DEMO_TRAJECTORIES.filter((student) => moduleFilter === "all" || student.module === moduleFilter)
      .map((student) => computeRisk(student))
      .filter((student): student is AtRiskStudent => student !== null)
      .sort((left, right) => right.riskScore - left.riskScore);
  }, [moduleFilter]);

  const atRiskStudentFilterIndex = useMemo(
    () => buildAtRiskStudentFilterIndex(atRiskStudents),
    [atRiskStudents],
  );

  const filteredAtRiskStudents = useMemo(() => {
    return filterAtRiskStudents({
      students: atRiskStudents,
      riskFilter,
      scoreBandFilter,
      index: atRiskStudentFilterIndex,
    });
  }, [atRiskStudents, atRiskStudentFilterIndex, riskFilter, scoreBandFilter]);

  const reportingReadiness = useMemo(
    () =>
      getPerformanceReportingReadiness({
        assessmentTrends,
        atRiskStudents,
        gradeDist,
      }),
    [assessmentTrends, atRiskStudents, gradeDist],
  );

  const updateFilters = (nextRisk: string, nextScoreBand: string) => {
    const next = new URLSearchParams(searchParams);
    if (nextRisk === "all") next.delete("risk");
    else next.set("risk", nextRisk);

    if (nextScoreBand === "all") next.delete("scoreBand");
    else next.set("scoreBand", nextScoreBand);

    setSearchParams(next);
  };

  const noData = assessmentTrends.length === 0 && gradeDist.every((entry) => entry.count === 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <DashboardDemoBanner label="Viewing demo performance trends data" />

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
        modules={modules}
        moduleFilter={moduleFilter}
        riskFilter={riskFilter}
        scoreBandFilter={scoreBandFilter}
        atRiskCount={atRiskStudents.length}
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
          {assessmentTrends.length > 0 && (
            <Suspense fallback={<DashboardLoadingState testId="performance-trends-chart-loading" />}>
              <AssessmentTrendsCard assessmentTrends={assessmentTrends} />
            </Suspense>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Suspense fallback={<DashboardLoadingState testId="performance-grade-distribution-loading" />}>
              <GradeDistributionCard gradeDist={gradeDist} />
            </Suspense>
            <StudentSupportSummaryCard filteredStudents={filteredAtRiskStudents} allAtRiskCount={atRiskStudents.length} />
          </div>

          <EarlySupportSignalsCard
            students={filteredAtRiskStudents}
            allAtRiskCount={atRiskStudents.length}
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

export default DemoPerformanceTrends;
