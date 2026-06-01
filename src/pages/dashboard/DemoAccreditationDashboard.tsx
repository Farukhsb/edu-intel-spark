import { DashboardLoadingState } from "@/components/dashboard/PageStates";
import { AccreditationDashboardScreen } from "./accreditation-dashboard";
import { useDemoAccreditationDashboardController } from "./accreditation-dashboard/useDemoAccreditationDashboardController";

const DemoAccreditationDashboard = () => {
  const controller = useDemoAccreditationDashboardController();

  if (controller.loading) {
    return <DashboardLoadingState />;
  }

  return <AccreditationDashboardScreen {...controller} />;
};

export default DemoAccreditationDashboard;
