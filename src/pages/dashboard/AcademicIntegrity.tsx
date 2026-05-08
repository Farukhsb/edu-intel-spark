import { Card, CardContent } from "@/components/ui/card";
import { DashboardLoadingState } from "@/components/dashboard/PageStates";
import { log } from "@/lib/logger";
import {
  AcademicIntegrityScreen,
  decisionOptions,
  useAcademicIntegrityController,
} from "./academic-integrity";

const AcademicIntegrity = () => {
  const controller = useAcademicIntegrityController();

  if (controller.loading) {
    return <DashboardLoadingState />;
  }

  try {
    return <AcademicIntegrityScreen {...controller} decisionOptions={decisionOptions} />;
  } catch (error) {
    log.error("Academic integrity page render failed", error);
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Academic integrity data could not be rendered cleanly. Reload the page or re-run the integrity check for the affected assignment.
        </CardContent>
      </Card>
    );
  }
};

export default AcademicIntegrity;
