import { DashboardLoadingState } from "@/components/dashboard/PageStates";
import { AccreditationDashboardScreen, useAccreditationDashboardController } from "./accreditation-dashboard";

const AccreditationDashboard = () => {
  const controller = useAccreditationDashboardController();

  if (controller.loading) {
    return <DashboardLoadingState />;
  }

  return <AccreditationDashboardScreen {...controller} />;
};

export default AccreditationDashboard;
