import { DashboardLoadingState } from "@/components/dashboard/PageStates";
import { DemoModerationDashboardScreen } from "./moderation-dashboard/ui/demo-screen";
import { useDemoModerationDashboardController } from "./moderation-dashboard/useDemoModerationDashboardController";

const DemoModerationDashboard = () => {
  const { loading, screenProps } = useDemoModerationDashboardController();

  if (loading) {
    return <DashboardLoadingState />;
  }
  return <DemoModerationDashboardScreen {...screenProps} />;
};

export default DemoModerationDashboard;
