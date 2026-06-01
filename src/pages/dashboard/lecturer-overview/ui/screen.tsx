import type { LecturerOverviewReadiness } from "@/lib/lecturerOverviewReadiness";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { LecturerOverviewActionCardSection } from "./action-card-section";
import { LecturerOverviewAtRiskSummarySection } from "./at-risk-summary-section";
import { LecturerOverviewHeroSection } from "./hero-section";
import { LecturerOverviewRecentSubmissionsSection } from "./recent-submissions-section";
import { LecturerOverviewPrimaryStatsSection, LecturerOverviewSecondaryStatsSection } from "./stats-sections";
import { LecturerOverviewWorkflowPipelineSection } from "./workflow-pipeline-section";
import type {
  LecturerOverviewAssignment,
  LecturerOverviewAtRiskSummary,
  LecturerOverviewPipelineStage,
  LecturerOverviewQueueFocus,
  LecturerOverviewRecentSubmission,
  LecturerOverviewStats,
  LecturerOverviewWorkflowTarget,
} from "../types";

export const LecturerOverviewScreen = ({
  profile,
  stats,
  recent,
  pipeline,
  readiness,
  topAtRiskStudents,
  heroSummary,
  loadWarning,
  assignments,
  primaryWorkflowTarget,
  queueFocus,
}: {
  profile: { full_name?: string | null } | null | undefined;
  stats: LecturerOverviewStats;
  recent: LecturerOverviewRecentSubmission[];
  pipeline: LecturerOverviewPipelineStage[];
  readiness: LecturerOverviewReadiness;
  topAtRiskStudents: LecturerOverviewAtRiskSummary[];
  heroSummary: string;
  loadWarning: string | null;
  assignments: LecturerOverviewAssignment[];
  primaryWorkflowTarget: LecturerOverviewWorkflowTarget | null;
  queueFocus: LecturerOverviewQueueFocus;
}) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <LecturerOverviewHeroSection
        profile={profile}
        heroSummary={heroSummary}
        assignments={assignments}
      />
      {loadWarning ? (
        <Alert className="border-warning/30 bg-warning/5 text-warning-foreground">
          <AlertTitle>Partial data loaded</AlertTitle>
          <AlertDescription>{loadWarning}</AlertDescription>
        </Alert>
      ) : null}
      <LecturerOverviewActionCardSection
        stats={stats}
        readiness={readiness}
        primaryWorkflowTarget={primaryWorkflowTarget}
        queueFocus={queueFocus}
      />
      <LecturerOverviewPrimaryStatsSection stats={stats} primaryWorkflowTarget={primaryWorkflowTarget} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,1fr)]">
        <LecturerOverviewRecentSubmissionsSection recent={recent} />
        <LecturerOverviewWorkflowPipelineSection pipeline={pipeline} />
      </div>

      <LecturerOverviewAtRiskSummarySection students={topAtRiskStudents} />

      <LecturerOverviewSecondaryStatsSection stats={stats} />
    </div>
  );
};
