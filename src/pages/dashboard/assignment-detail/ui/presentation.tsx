import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { safeFormatDate } from "@/lib/date";
import { formatSubmissionStatus } from "@/lib/moderation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  FileText,
  Sparkles,
} from "lucide-react";

import type { IntegrityCardPresentation } from "@/pages/dashboard/assignment-detail/domain";
import type { AssignmentDetailAssignment } from "@/pages/dashboard/assignment-detail/types";
import type { WorkflowReadinessState } from "@/pages/dashboard/assignment-detail/domain";
import type { AcademicIntegrityFlag, WorkflowRubricCriterion } from "@/types/academic";

const formatStatusLabel = (status: string) => formatSubmissionStatus(status);

export const AssignmentDemoBanner = () => (
  <Card className="border-warning bg-warning/5 shadow-sm">
    <CardContent className="flex items-center gap-2 p-3">
      <Badge variant="outline" className="border-warning text-warning">Demo</Badge>
      <span className="text-sm text-muted-foreground">Demo Mode — synthetic sample data</span>
    </CardContent>
  </Card>
);

export const AssignmentDemoSetCard = ({
  label,
  name,
  reviewerSummary,
}: {
  label: string;
  name: string;
  reviewerSummary: string;
}) => (
  <Card className="border-primary/20 bg-background shadow-sm">
    <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{reviewerSummary}</p>
      </div>
      <Badge variant="outline" className="text-xs">
        {label}
      </Badge>
    </CardContent>
  </Card>
);

export const AssignmentDemoWorkflowCard = () => (
  <Card className="border-primary/20 bg-primary/5 shadow-sm">
    <CardContent className="grid gap-3 p-4 md:grid-cols-3">
      <div>
        <p className="text-sm font-medium">1. Create and scope</p>
        <p className="mt-1 text-xs text-muted-foreground">
          The Assignments page shows the real draft workflow: brief, due date, cohort targeting, and rubric setup before publish.
        </p>
      </div>
      <div>
        <p className="text-sm font-medium">2. Review what AI receives</p>
        <p className="mt-1 text-xs text-muted-foreground">
          This synthetic assignment includes the full brief, rubric, sample submissions, and integrity evidence the grader would inspect.
        </p>
      </div>
      <div>
        <p className="text-sm font-medium">3. Review expected output</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Use the submission list to inspect AI scores, criterion feedback, moderation-ready cases, and a released feedback example.
        </p>
      </div>
    </CardContent>
  </Card>
);

export const AssignmentHeroCard = ({
  assignment,
  onBack,
  summary,
}: {
  assignment: AssignmentDetailAssignment;
  onBack: () => void;
  summary: {
    submittedCount: number;
    gradedCount: number;
    releasedCount: number;
  };
}) => (
  <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shadow-sm">
    <CardContent className="flex flex-col gap-5 p-6 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" className="mt-0.5 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/20 bg-background/70 text-xs">
              <Sparkles className="mr-1 h-3 w-3" /> Assignment workflow
            </Badge>
            {assignment.module_code && (
              <Badge variant="outline" className="text-xs">
                {assignment.module_code}
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold font-display">{assignment.title}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {assignment.description || "Manage submissions, grading, lecturer review, and release workflow for this assignment."}
          </p>
          <div className="flex flex-wrap gap-4 pt-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Max score: {assignment.max_score}
            </span>
            {assignment.due_date && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" /> Due {safeFormatDate(assignment.due_date, "MMM d, yyyy")}
              </span>
            )}
            <span>Status: {formatStatusLabel(assignment.status)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:min-w-[360px]">
        {[
          { label: "Submissions", value: summary.submittedCount },
          { label: "Graded", value: summary.gradedCount },
          { label: "Released", value: summary.releasedCount },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border bg-background/70 p-4 text-center shadow-sm">
            <p className="text-2xl font-bold font-display">{item.value}</p>
            <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

export const AssignmentReadinessCard = ({
  isLecturer,
  workflowReadiness,
}: {
  isLecturer: boolean;
  workflowReadiness: WorkflowReadinessState;
}) => (
  <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shadow-sm">
    <CardHeader>
      <CardTitle className="text-base">Reporting Readiness</CardTitle>
    </CardHeader>
    <CardContent className="grid gap-4 md:grid-cols-3">
      <div className="rounded-lg border bg-background/70 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current posture</p>
        <p className="mt-2 text-sm font-semibold">{workflowReadiness.postureLabel}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {isLecturer
            ? "Based on current submission states, moderation blockers, release readiness, and integrity runtime limits."
            : "Based on your current submission state in the assessment workflow."}
        </p>
      </div>
      <div className="rounded-lg border bg-background/70 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Likely challenge</p>
        <p className="mt-2 text-sm font-semibold">{workflowReadiness.likelyChallenge}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {isLecturer
            ? "This is the workflow line most likely to need immediate action or explanation."
            : "This is the current checkpoint most likely to affect when your result becomes available."}
        </p>
      </div>
      <div className="rounded-lg border bg-background/70 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Best next action</p>
        <p className="mt-2 text-sm font-semibold">{workflowReadiness.bestNextAction}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {isLecturer
            ? "Use this to decide whether to review, moderate, approve, or release next."
            : "Use this to decide whether to submit now or wait for the next workflow step."}
        </p>
      </div>
    </CardContent>
  </Card>
);

export const AssignmentFocusCard = ({
  clearLabel,
  description,
  onClear,
  onShare,
  shareLabel,
  testId,
  title,
}: {
  clearLabel: string;
  description: string;
  onClear: () => void;
  onShare?: () => void;
  shareLabel?: string;
  testId: string;
  title: string;
}) => (
  <Card data-testid={testId} className="border-primary/20 bg-primary/5 shadow-sm">
    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {onShare && shareLabel ? (
          <Button type="button" variant="outline" size="sm" onClick={onShare}>
            {shareLabel}
          </Button>
        ) : null}
        <Button type="button" variant="outline" size="sm" onClick={onClear}>
          {clearLabel}
        </Button>
      </div>
    </CardContent>
  </Card>
);

export const AssignmentRubricCard = ({
  rubric,
}: {
  rubric: WorkflowRubricCriterion[];
}) => (
  <Card className="shadow-sm">
    <CardHeader className="pb-3">
      <CardTitle className="text-base">Rubric</CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      {rubric.map((criterion, index) => (
        <div key={index} className="rounded-xl border p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">{criterion.criterion}</span>
            <Badge variant="outline">{criterion.weight} pts</Badge>
          </div>
          {criterion.description && (
            <p className="mt-2 text-xs text-muted-foreground">{criterion.description}</p>
          )}
        </div>
      ))}
    </CardContent>
  </Card>
);

export const AssignmentIntegrityCard = ({
  integrityCard,
  onClear,
  plagiarismFlags,
  plagiarismSummary,
}: {
  integrityCard: IntegrityCardPresentation;
  onClear?: () => void;
  plagiarismFlags: AcademicIntegrityFlag[];
  plagiarismSummary: string | null;
}) => (
  <Card
    className={
      integrityCard.cardTone === "clear"
        ? "border-emerald-500/20 bg-emerald-500/5 shadow-sm"
        : "border-warning/30 bg-warning/5 shadow-sm"
    }
  >
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-base">
        <AlertTriangle className="h-4 w-4 text-warning" /> Integrity Check Results
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-muted-foreground">{plagiarismSummary}</p>
        {integrityCard.badgeLabel ? (
          integrityCard.cardTone === "clear" && onClear ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 shrink-0 rounded-full px-3 text-xs"
              onClick={onClear}
            >
              {integrityCard.badgeLabel}
            </Button>
          ) : (
            <Badge
              variant={
                integrityCard.cardTone === "flagged"
                  ? "destructive"
                  : integrityCard.cardTone === "limited"
                    ? "secondary"
                    : "outline"
              }
              className="shrink-0"
            >
              {integrityCard.badgeLabel}
            </Badge>
          )
        ) : null}
      </div>
      {integrityCard.cardTone === "limited" && plagiarismFlags.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          No pairwise flags were produced, but this run had limited coverage. Review the notes above before treating the result as clear.
        </p>
      ) : null}
      <Accordion type="multiple" className="space-y-3">
        {plagiarismFlags.map((flag, index) => (
          <AccordionItem key={index} value={`integrity-flag-${index}`} className="rounded-xl border bg-background px-3">
            <AccordionTrigger className="gap-3 py-3 hover:no-underline">
              <div className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {flag.student_a} {"<->"} {flag.student_b}
                  </p>
                </div>
                <Badge
                  variant={
                    flag.severity === "high"
                      ? "destructive"
                      : flag.severity === "medium"
                        ? "secondary"
                        : "outline"
                  }
                  className="shrink-0"
                >
                  {flag.total_risk_score || flag.similarity_score}% risk
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-3 pt-0">
              <p className="text-xs text-muted-foreground">{flag.reason}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Raw overlap {flag.overlap_analysis?.total_overlap || 0}% | Similarity risk {flag.similarity_score}% | Uncited {flag.overlap_analysis?.uncited_overlap || 0}% | Cited {flag.overlap_analysis?.cited_overlap || 0}% | AI {flag.ai_suspicion_score || 0}% | Baseline {flag.baseline_deviation_score || 0}% | Total risk {flag.total_risk_score || 0}%
              </p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </CardContent>
  </Card>
);
