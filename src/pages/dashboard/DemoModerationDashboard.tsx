import { DashboardLoadingState } from "@/components/dashboard/PageStates";
import { ModerationDashboardScreen } from "./moderation-dashboard";
import { useDemoModerationDashboardController } from "./moderation-dashboard/useDemoModerationDashboardController";

const DemoModerationDashboard = () => {
  const { loading, screenProps } = useDemoModerationDashboardController();

  if (loading) {
    return <DashboardLoadingState />;
  }
  return <ModerationDashboardScreen {...screenProps} />;
};

export default DemoModerationDashboard;
