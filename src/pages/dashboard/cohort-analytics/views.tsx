import { lazy, Suspense } from "react";
import type { ReactElement } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Lightbulb, Shield, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardEmptyState, DashboardLoadingState } from "@/components/dashboard/PageStates";
import type { CohortRecommendation } from "@/lib/cohortRecommendations";
import type { CohortAtRiskStudentSummary, AssignmentAnalytics, GradeBand } from "./types";
import {
  formatStatusLabel,
  getRecommendationActionSummary,
  severityVariant,
  statusVariant,
} from "./useCohortAnalyticsController";

const GradeDistributionChart = lazy(() =>
  import("@/pages/dashboard/cohort-analytics/distribution-chart").then((module) => ({
    default: module.GradeDistributionChart,
  })),
);

export type CohortDashboardView = "tutor" | "course-leader" | "hod";

export interface CohortDashboardViewProps {
  modules: AssignmentAnalytics[];
  moduleFilter: string;
  setModuleFilter: (value: string) => void;
  gradeDistChart: GradeBand[];
  filteredModules: AssignmentAnalytics[];
  visibleRecommendations: CohortRecommendation[];
  reportingReadiness: {
    postureLabel: string;
    likelyChallenge: string;
    bestNextAction: string;
  };
  topAtRiskStudents: CohortAtRiskStudentSummary[];
  actingId: string | null;
  handleReview: (recommendation: CohortRecommendation) => void;
  handleDismiss: (recommendation: CohortRecommendation) => void;
  handleCreateIntervention: (recommendation: CohortRecommendation) => void;
  handleCopyWorkflowLink: (recommendation: CohortRecommendation) => void;
}

const filterRecommendations = (recommendations: CohortRecommendation[], scope: CohortDashboardView) => {
  if (scope === "tutor") {
    return recommendations.filter((recommendation) =>
      ["student risk", "integrity alerts"].includes(recommendation.type),
    );
  }

  if (scope === "course-leader") {
    return recommendations.filter((recommendation) =>
      recommendation.type === "performance" || Boolean(recommendation.assignmentId),
    );
  }

  return recommendations;
};

const renderRecommendationCard = (
  recommendation: CohortRecommendation,
  actingId: string | null,
  handleReview: (recommendation: CohortRecommendation) => void,
  handleDismiss: (recommendation: CohortRecommendation) => void,
  handleCreateIntervention: (recommendation: CohortRecommendation) => void,
  handleCopyWorkflowLink: (recommendation: CohortRecommendation) => void,
) => {
  const actionSummary = getRecommendationActionSummary(recommendation);

  return (
    <Card key={recommendation.id} className="border-l-4 border-l-primary">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3">
            <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium text-sm">{recommendation.title}</h3>
                <Badge variant={severityVariant(recommendation.severity)} className="text-xs">
                  {recommendation.severity}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {recommendation.type}
                </Badge>
                <Badge variant={statusVariant(recommendation.status)} className="text-xs">
                  {formatStatusLabel(recommendation.status)}
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground">{recommendation.summary}</p>
              <p className="text-sm">{recommendation.explanation}</p>

              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Evidence</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {recommendation.evidence.metrics.map((metric) => (
                    <Badge key={`${recommendation.id}-${metric.label}`} variant="outline" className="text-xs">
                      {metric.label}: {metric.value}
                    </Badge>
                  ))}
                </div>
                {recommendation.evidence.affectedStudentNames &&
                recommendation.evidence.affectedStudentNames.length > 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Affected students: {recommendation.evidence.affectedStudentNames.join(", ")}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Suggested Actions</p>
                {recommendation.recommendedActions.map((action) => (
                  <div key={`${recommendation.id}-${action}`} className="flex items-start gap-2 text-sm">
                    <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>{action}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border bg-muted/20 p-3" data-testid={`recommendation-action-summary-${recommendation.id}`}>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Operational handoff</p>
                <p className="mt-2 text-sm font-semibold">{actionSummary.headline}</p>
                <p className="mt-1 text-sm text-muted-foreground">{actionSummary.detail}</p>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2 lg:w-[240px] lg:justify-end">
            <Button
              size="sm"
              variant="outline"
              disabled={actingId === recommendation.id}
              onClick={() => handleReview(recommendation)}
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              Review
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={actingId === recommendation.id}
              onClick={() => handleDismiss(recommendation)}
            >
              <Shield className="mr-1.5 h-3.5 w-3.5" />
              Dismiss
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={actingId === recommendation.id}
              onClick={() => handleCopyWorkflowLink(recommendation)}
            >
              <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
              Copy workflow link
            </Button>
            <Button size="sm" disabled={actingId === recommendation.id} onClick={() => handleCreateIntervention(recommendation)}>
              {recommendation.type === "student risk" ? (
                <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="mr-1.5 h-3.5 w-3.5" />
              )}
              {actionSummary.primaryLabel}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const RecommendationList = ({
  recommendations,
  actingId,
  handleReview,
  handleDismiss,
  handleCreateIntervention,
  handleCopyWorkflowLink,
}: {
  recommendations: CohortRecommendation[];
  actingId: string | null;
  handleReview: (recommendation: CohortRecommendation) => void;
  handleDismiss: (recommendation: CohortRecommendation) => void;
  handleCreateIntervention: (recommendation: CohortRecommendation) => void;
  handleCopyWorkflowLink: (recommendation: CohortRecommendation) => void;
}) => (
  <div className="space-y-4">
    {recommendations.length === 0 ? (
      <DashboardEmptyState
        title="No recommendations yet"
        description="Explainable recommendations will appear here once enough analytics data is available."
      />
    ) : (
      recommendations.map((recommendation) =>
        renderRecommendationCard(
          recommendation,
          actingId,
          handleReview,
          handleDismiss,
          handleCreateIntervention,
          handleCopyWorkflowLink,
        ),
      )
    )}
  </div>
);

const SummaryCards = ({
  title,
  description,
  cards,
}: {
  title: string;
  description: string;
  cards: Array<{ label: string; value: string; helper: string }>;
}) => (
  <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
    <CardHeader>
      <CardTitle className="text-base">{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent className="grid gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg border bg-background/70 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{card.label}</p>
          <p className="mt-2 text-sm font-semibold">{card.value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{card.helper}</p>
        </div>
      ))}
    </CardContent>
  </Card>
);

const AssignmentComparison = ({
  modules,
}: {
  modules: AssignmentAnalytics[];
}) => (
  <div className="grid gap-4 sm:grid-cols-2">
    {modules.length === 0 ? (
      <div className="sm:col-span-2">
        <DashboardEmptyState
          title="No assignments found"
          description="Assignment comparison appears after assignments and grading data are available."
        />
      </div>
    ) : (
      modules.map((module) => (
        <Card key={module.id}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-sm">
                  {module.moduleCode ? `${module.moduleCode} - ` : ""}
                  {module.title}
                </p>
                <p className="mt-1 text-3xl font-bold font-display">{module.gradedCount > 0 ? `${module.avgScore}%` : "-"}</p>
                <p className="text-xs text-muted-foreground">Average Grade</p>
              </div>
              {module.submissions > 0 ? (
                <Badge
                  variant={module.passRate >= 80 ? "default" : module.passRate >= 70 ? "secondary" : "destructive"}
                >
                  {module.passRate}% pass
                </Badge>
              ) : null}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span>{module.submissions} submissions</span>
              <span>{module.gradedCount} graded</span>
              <span>{module.failRate}% fail rate</span>
            </div>
          </CardContent>
        </Card>
      ))
    )}
  </div>
);

const TopRiskStudents = ({ students }: { students: CohortAtRiskStudentSummary[] }) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">Students needing attention</CardTitle>
      <CardDescription>The highest-risk students are shown first.</CardDescription>
    </CardHeader>
    <CardContent>
      {students.length === 0 ? (
        <DashboardEmptyState
          title="No high-risk students yet"
          description="This panel will populate once risk scores identify students who need a closer follow-up."
        />
      ) : (
        <div className="space-y-3">
          {students.map((student) => (
            <div key={student.studentId} className="rounded-lg border bg-muted/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{student.name}</p>
                  <p className="text-xs text-muted-foreground">{student.signal}</p>
                </div>
                <Badge variant={student.riskLevel === "critical" ? "destructive" : "secondary"} className="text-xs">
                  {student.riskLevel}
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>{student.riskScore}/100</span>
                <span>Trend: {student.trend}</span>
                <span>Predicted next: {student.predictedNext}%</span>
              </div>
              <p className="mt-2 text-sm">{student.recommendation}</p>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);

const TutorView = (props: CohortDashboardViewProps) => {
  const recommendations = filterRecommendations(props.visibleRecommendations, "tutor");

  return (
    <div className="space-y-6 animate-fade-in">
      <SummaryCards
        title="Personal tutor view"
        description="Use this view to spot students who need support before the next deadline."
        cards={[
          {
            label: "Current position",
            value: props.reportingReadiness.postureLabel,
            helper: "A quick read of the cohort support posture.",
          },
          {
            label: "What needs attention",
            value: props.reportingReadiness.likelyChallenge,
            helper: "The most likely support or review pressure.",
          },
          {
            label: "Next step",
            value: props.reportingReadiness.bestNextAction,
            helper: "The most sensible immediate action for a tutor.",
          },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <TopRiskStudents students={props.topAtRiskStudents} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Student support actions</CardTitle>
            <CardDescription>Student-risk and integrity actions worth following up now.</CardDescription>
          </CardHeader>
          <CardContent>
            <RecommendationList
              recommendations={recommendations}
              actingId={props.actingId}
              handleReview={props.handleReview}
              handleDismiss={props.handleDismiss}
              handleCreateIntervention={props.handleCreateIntervention}
              handleCopyWorkflowLink={props.handleCopyWorkflowLink}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const CourseLeaderView = (props: CohortDashboardViewProps) => {
  const recommendations = filterRecommendations(props.visibleRecommendations, "course-leader");

  return (
    <div className="space-y-6 animate-fade-in">
      <SummaryCards
        title="Course leader view"
        description="Use this view to compare assessment patterns, identify weak modules, and keep the cohort moving."
        cards={[
          {
            label: "Cohort posture",
            value: props.reportingReadiness.postureLabel,
            helper: "The current cohort-level reporting position.",
          },
          {
            label: "Weakest signal",
            value: props.reportingReadiness.likelyChallenge,
            helper: "The clearest assessment pressure in the view.",
          },
          {
            label: "Recommended action",
            value: props.reportingReadiness.bestNextAction,
            helper: "A practical next step for a course leader.",
          },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Grade distribution</CardTitle>
          <CardDescription>
            {props.moduleFilter === "all" ? "Cohort classification breakdown" : "Distribution for the selected assignment"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {props.gradeDistChart.every((item) => item.count === 0) ? (
            <DashboardEmptyState
              title="No graded submissions yet"
              description="This view will populate once submissions have been graded and released."
            />
          ) : (
            <Suspense fallback={<DashboardLoadingState testId="cohort-dashboard-grade-distribution-loading" />}>
              <GradeDistributionChart gradeDistChart={props.gradeDistChart} />
            </Suspense>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assignment comparison</CardTitle>
          <CardDescription>Compare module performance at a glance.</CardDescription>
        </CardHeader>
        <CardContent>
          <AssignmentComparison modules={props.filteredModules} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance recommendations</CardTitle>
          <CardDescription>Assignment-level actions and cohort performance follow-ups.</CardDescription>
        </CardHeader>
        <CardContent>
          <RecommendationList
            recommendations={recommendations}
            actingId={props.actingId}
            handleReview={props.handleReview}
            handleDismiss={props.handleDismiss}
            handleCreateIntervention={props.handleCreateIntervention}
            handleCopyWorkflowLink={props.handleCopyWorkflowLink}
          />
        </CardContent>
      </Card>
    </div>
  );
};

const HeadOfDepartmentView = (props: CohortDashboardViewProps) => {
  const recommendations = filterRecommendations(props.visibleRecommendations, "hod");
  const highPriorityCount = recommendations.filter((recommendation) => recommendation.severity === "high" || recommendation.severity === "critical").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <SummaryCards
        title="Head of Department view"
        description="Use this view for programme oversight, risk concentration, and reporting readiness."
        cards={[
          {
            label: "Reporting posture",
            value: props.reportingReadiness.postureLabel,
            helper: "The overall reporting readiness for the cohort.",
          },
          {
            label: "Attention needed",
            value: props.reportingReadiness.likelyChallenge,
            helper: "The issue most likely to require departmental escalation.",
          },
          {
            label: "High-priority items",
            value: String(highPriorityCount),
            helper: "Critical and high-severity recommendations currently active.",
          },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Governance and readiness</CardTitle>
            <CardDescription>Department-level signals that are useful in formal reporting.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Posture</p>
              <p className="mt-2 text-sm font-semibold">{props.reportingReadiness.postureLabel}</p>
              <p className="mt-1 text-sm text-muted-foreground">{props.reportingReadiness.bestNextAction}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Operational challenge</p>
              <p className="mt-2 text-sm font-semibold">{props.reportingReadiness.likelyChallenge}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                This is the issue most likely to surface in board, quality, or scrutiny conversations.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Departmental risk monitor</CardTitle>
            <CardDescription>Students and recommendations that need escalation or oversight.</CardDescription>
          </CardHeader>
          <CardContent>
            <TopRiskStudents students={props.topAtRiskStudents} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Open recommendations</CardTitle>
          <CardDescription>All current cohort recommendations with action controls.</CardDescription>
        </CardHeader>
        <CardContent>
          <RecommendationList
            recommendations={recommendations}
            actingId={props.actingId}
            handleReview={props.handleReview}
            handleDismiss={props.handleDismiss}
            handleCreateIntervention={props.handleCreateIntervention}
            handleCopyWorkflowLink={props.handleCopyWorkflowLink}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export const cohortDashboardViewComponents = {
  tutor: TutorView,
  "course-leader": CourseLeaderView,
  hod: HeadOfDepartmentView,
} as const satisfies Record<CohortDashboardView, (props: CohortDashboardViewProps) => ReactElement>;
