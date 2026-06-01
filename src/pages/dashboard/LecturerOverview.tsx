import { DashboardErrorState, DashboardLoadingState } from "@/components/dashboard/PageStates";
import { Button } from "@/components/ui/button";

import { LecturerOverviewScreen, useLecturerOverviewController } from "@/pages/dashboard/lecturer-overview";

const LecturerOverview = () => {
  const {
    profile,
    state: {
      loading,
      error,
      loadWarning,
      assignments,
      stats,
      recent,
      pipeline,
      readiness,
      topAtRiskStudents,
      heroSummary,
      primaryWorkflowTarget,
      queueFocus,
    },
    actions: { reload },
  } = useLecturerOverviewController();

  if (loading) {
    return <DashboardLoadingState testId="loading-spinner" />;
  }

  if (error) {
    return (
      <DashboardErrorState
        title="Lecturer overview unavailable"
        description={error}
        action={
          <Button onClick={reload} variant="outline">
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <LecturerOverviewScreen
      profile={profile}
      stats={stats}
      recent={recent}
      pipeline={pipeline}
      readiness={readiness}
      topAtRiskStudents={topAtRiskStudents}
      heroSummary={heroSummary}
      loadWarning={loadWarning}
      assignments={assignments}
      primaryWorkflowTarget={primaryWorkflowTarget}
      queueFocus={queueFocus}
    />
  );
};

export default LecturerOverview;
