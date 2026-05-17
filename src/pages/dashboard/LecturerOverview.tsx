import { DashboardLoadingState } from "@/components/dashboard/PageStates";

import { LecturerOverviewScreen, useLecturerOverviewController } from "@/pages/dashboard/lecturer-overview";

const LecturerOverview = () => {
  const {
    profile,
    state: {
      loading,
      stats,
      recent,
      gradeDistribution,
      pipeline,
      totalScored,
      readiness,
      heroSummary,
      primaryWorkflowTarget,
      queueFocus,
    },
    actions: { exportCsv, exportPdf },
  } = useLecturerOverviewController();

  if (loading) {
    return <DashboardLoadingState testId="loading-spinner" />;
  }

  return (
    <LecturerOverviewScreen
      profile={profile}
      stats={stats}
      recent={recent}
      gradeDistribution={gradeDistribution}
      pipeline={pipeline}
      totalScored={totalScored}
      readiness={readiness}
      heroSummary={heroSummary}
      primaryWorkflowTarget={primaryWorkflowTarget}
      queueFocus={queueFocus}
      onExportCsv={exportCsv}
      onExportPdf={exportPdf}
    />
  );
};

export default LecturerOverview;
