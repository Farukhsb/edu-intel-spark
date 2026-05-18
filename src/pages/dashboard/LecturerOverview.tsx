import { DashboardLoadingState } from "@/components/dashboard/PageStates";

import { LecturerOverviewScreen, useLecturerOverviewController } from "@/pages/dashboard/lecturer-overview";

const LecturerOverview = () => {
  const {
    profile,
    state: {
      loading,
      stats,
      recent,
      pipeline,
      readiness,
      heroSummary,
      primaryWorkflowTarget,
      queueFocus,
    },
  } = useLecturerOverviewController();

  if (loading) {
    return <DashboardLoadingState testId="loading-spinner" />;
  }

  return (
    <LecturerOverviewScreen
      profile={profile}
      stats={stats}
      recent={recent}
      pipeline={pipeline}
      readiness={readiness}
      heroSummary={heroSummary}
      primaryWorkflowTarget={primaryWorkflowTarget}
      queueFocus={queueFocus}
    />
  );
};

export default LecturerOverview;
