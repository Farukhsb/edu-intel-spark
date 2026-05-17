import { Suspense, lazy } from "react";
import type { LecturerOverviewReadiness } from "@/lib/lecturerOverviewReadiness";

import { LecturerOverviewActionCardSection } from "./action-card-section";
import { LecturerOverviewExportSection } from "./export-section";
import { LecturerOverviewHeroSection } from "./hero-section";
import { LecturerOverviewRecentSubmissionsSection } from "./recent-submissions-section";
import { LecturerOverviewPrimaryStatsSection, LecturerOverviewSecondaryStatsSection } from "./stats-sections";
import { LecturerOverviewWorkflowPipelineSection } from "./workflow-pipeline-section";
import type {
  LecturerOverviewDistributionBand,
  LecturerOverviewPipelineStage,
  LecturerOverviewQueueFocus,
  LecturerOverviewRecentSubmission,
  LecturerOverviewStats,
  LecturerOverviewWorkflowTarget,
} from "../types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const LecturerOverviewGradeDistributionSection = lazy(() =>
  import("./grade-distribution-section").then((module) => ({
    default: module.LecturerOverviewGradeDistributionSection,
  })),
);

const LecturerOverviewGradeDistributionLoadingCard = () => (
  <Card className="shadow-sm">
    <CardHeader className="pb-3">
      <CardTitle className="text-base">Grade Distribution</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="h-[220px] animate-pulse rounded-lg bg-muted/40" />
    </CardContent>
  </Card>
);

export const LecturerOverviewScreen = ({
  profile,
  stats,
  recent,
  gradeDistribution,
  pipeline,
  totalScored,
  readiness,
  heroSummary,
  primaryWorkflowTarget,
  queueFocus,
  onExportCsv,
  onExportPdf,
}: {
  profile: { full_name?: string | null } | null | undefined;
  stats: LecturerOverviewStats;
  recent: LecturerOverviewRecentSubmission[];
  gradeDistribution: LecturerOverviewDistributionBand[];
  pipeline: LecturerOverviewPipelineStage[];
  totalScored: number;
  readiness: LecturerOverviewReadiness;
  heroSummary: string;
  primaryWorkflowTarget: LecturerOverviewWorkflowTarget | null;
  queueFocus: LecturerOverviewQueueFocus;
  onExportCsv: () => void;
  onExportPdf: () => Promise<void>;
}) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <LecturerOverviewHeroSection
        profile={profile}
        heroSummary={heroSummary}
        stats={stats}
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

      <div className="grid gap-6 xl:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.1fr)]">
        <LecturerOverviewSecondaryStatsSection stats={stats} />
        <Suspense fallback={<LecturerOverviewGradeDistributionLoadingCard />}>
          <LecturerOverviewGradeDistributionSection
            gradeDistribution={gradeDistribution}
            totalScored={totalScored}
          />
        </Suspense>
      </div>

      <LecturerOverviewExportSection onExportCsv={onExportCsv} onExportPdf={onExportPdf} />
    </div>
  );
};
