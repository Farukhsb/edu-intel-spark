import { DashboardErrorState, DashboardLoadingState } from "@/components/dashboard/PageStates";
import { Button } from "@/components/ui/button";
import { CohortAnalyticsScreen, useCohortAnalyticsController } from "./cohort-analytics";

const CohortAnalytics = () => {
  const controller = useCohortAnalyticsController();

  if (controller.loading) {
    return <DashboardLoadingState />;
  }

  if (controller.loadError) {
    return (
      <DashboardErrorState
        title="Cohort dashboard unavailable"
        description={controller.loadError}
        action={
          <Button variant="outline" onClick={controller.reload}>
            Try again
          </Button>
        }
      />
    );
  }

  return <CohortAnalyticsScreen {...controller} />;
};

export default CohortAnalytics;
