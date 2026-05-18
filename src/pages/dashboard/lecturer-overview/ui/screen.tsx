import type { LecturerOverviewReadiness } from "@/lib/lecturerOverviewReadiness";

import { LecturerOverviewActionCardSection } from "./action-card-section";
import { LecturerOverviewHeroSection } from "./hero-section";
import { LecturerOverviewRecentSubmissionsSection } from "./recent-submissions-section";
import { LecturerOverviewPrimaryStatsSection, LecturerOverviewSecondaryStatsSection } from "./stats-sections";
import { LecturerOverviewWorkflowPipelineSection } from "./workflow-pipeline-section";
import type {
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
  heroSummary,
  primaryWorkflowTarget,
  queueFocus,
}: {
  profile: { full_name?: string | null } | null | undefined;
  stats: LecturerOverviewStats;
  recent: LecturerOverviewRecentSubmission[];
  pipeline: LecturerOverviewPipelineStage[];
  readiness: LecturerOverviewReadiness;
  heroSummary: string;
  primaryWorkflowTarget: LecturerOverviewWorkflowTarget | null;
  queueFocus: LecturerOverviewQueueFocus;
}) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <LecturerOverviewHeroSection
        profile={profile}
        heroSummary={heroSummary}
      />
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

      <LecturerOverviewSecondaryStatsSection stats={stats} />
    </div>
  );
};
