import { Card, CardContent } from "@/components/ui/card";
import { DashboardLoadingState } from "@/components/dashboard/PageStates";
import { log } from "@/lib/logger";
import { AccreditationDashboardScreen, useAccreditationDashboardController } from "./accreditation-dashboard";

const AccreditationDashboard = () => {
  const controller = useAccreditationDashboardController();

  if (controller.loading) {
    return <DashboardLoadingState />;
  }

  try {
    return <AccreditationDashboardScreen {...controller} />;
  } catch (error) {
    log.error("Accreditation dashboard render failed", error);
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Accreditation metrics could not be rendered from the current dataset. Reload the page after new assessment data is available.
        </CardContent>
      </Card>
    );
  }
};

export default AccreditationDashboard;
