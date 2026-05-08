import { DashboardLoadingState } from "@/components/dashboard/PageStates";
import { CohortAnalyticsScreen, useCohortAnalyticsController } from "./cohort-analytics";

const CohortAnalytics = () => {
  const controller = useCohortAnalyticsController();

  if (controller.loading) {
    return <DashboardLoadingState />;
  }

  return <CohortAnalyticsScreen {...controller} />;
};

export default CohortAnalytics;
