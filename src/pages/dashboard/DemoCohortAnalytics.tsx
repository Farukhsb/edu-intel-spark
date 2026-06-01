import { CohortAnalyticsScreen } from "./cohort-analytics";
import { useDemoCohortAnalyticsController } from "./cohort-analytics/useDemoCohortAnalyticsController";

const DemoCohortAnalytics = () => {
  const controller = useDemoCohortAnalyticsController();

  return <CohortAnalyticsScreen {...controller} />;
};

export default DemoCohortAnalytics;
