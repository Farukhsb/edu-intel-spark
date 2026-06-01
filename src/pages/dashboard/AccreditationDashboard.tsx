import { DashboardLoadingState } from "@/components/dashboard/PageStates";
import { LiveAccreditationDashboardScreen } from "./accreditation-dashboard/live-screen";
import { useAccreditationDashboardController } from "./accreditation-dashboard";

const AccreditationDashboard = () => {
  const controller = useAccreditationDashboardController();

  if (controller.loading) {
    return <DashboardLoadingState />;
  }

  return <LiveAccreditationDashboardScreen {...controller} />;
};

export default AccreditationDashboard;
