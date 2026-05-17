import { DashboardLoadingState } from "@/components/dashboard/PageStates";
import {
  ModerationDashboardScreen,
  useModerationDashboardController,
} from "@/pages/dashboard/moderation-dashboard";

const ModerationDashboard = () => {
  const { loading, screenProps } = useModerationDashboardController();

  if (loading) {
    return <DashboardLoadingState />;
  }
  return <ModerationDashboardScreen {...screenProps} />;
};

export default ModerationDashboard;
