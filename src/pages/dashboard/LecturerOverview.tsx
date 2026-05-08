import { Loader2 } from "lucide-react";

import { LecturerOverviewScreen, useLecturerOverviewController } from "@/pages/dashboard/lecturer-overview";

const LecturerOverview = () => {
  const {
    profile,
    state: { loading, stats, recent, gradeDistribution, totalScored, readiness, heroSummary },
    actions: { exportCsv, exportPdf },
  } = useLecturerOverviewController();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" data-testid="loading-spinner" />
      </div>
    );
  }

  return (
    <LecturerOverviewScreen
      profile={profile}
      stats={stats}
      recent={recent}
      gradeDistribution={gradeDistribution}
      totalScored={totalScored}
      readiness={readiness}
      heroSummary={heroSummary}
      onExportCsv={exportCsv}
      onExportPdf={exportPdf}
    />
  );
};

export default LecturerOverview;
