import type { LecturerOverviewReadiness } from "@/lib/lecturerOverviewReadiness";

import { LecturerOverviewAttentionNeededSection } from "./attention-needed-section";
import { LecturerOverviewExportSection } from "./export-section";
import { LecturerOverviewGradeDistributionSection } from "./grade-distribution-section";
import { LecturerOverviewHeroSection } from "./hero-section";
import { LecturerOverviewReadinessSection } from "./readiness-section";
import { LecturerOverviewRecentSubmissionsSection } from "./recent-submissions-section";
import { LecturerOverviewPrimaryStatsSection, LecturerOverviewSecondaryStatsSection } from "./stats-sections";
import type {
  LecturerOverviewDistributionBand,
  LecturerOverviewRecentSubmission,
  LecturerOverviewStats,
} from "../types";

export const LecturerOverviewScreen = ({
  profile,
  stats,
  recent,
  gradeDistribution,
  totalScored,
  readiness,
  heroSummary,
  onExportCsv,
  onExportPdf,
}: {
  profile: { full_name?: string | null } | null | undefined;
  stats: LecturerOverviewStats;
  recent: LecturerOverviewRecentSubmission[];
  gradeDistribution: LecturerOverviewDistributionBand[];
  totalScored: number;
  readiness: LecturerOverviewReadiness;
  heroSummary: string;
  onExportCsv: () => void;
  onExportPdf: () => Promise<void>;
}) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <LecturerOverviewHeroSection profile={profile} heroSummary={heroSummary} stats={stats} />
      <LecturerOverviewReadinessSection readiness={readiness} />
      <LecturerOverviewPrimaryStatsSection stats={stats} />
      <LecturerOverviewSecondaryStatsSection stats={stats} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <LecturerOverviewRecentSubmissionsSection recent={recent} />

        <div className="space-y-6">
          <LecturerOverviewGradeDistributionSection gradeDistribution={gradeDistribution} totalScored={totalScored} />
          <LecturerOverviewAttentionNeededSection stats={stats} />
        </div>
      </div>

      <LecturerOverviewExportSection onExportCsv={onExportCsv} onExportPdf={onExportPdf} />
    </div>
  );
};
