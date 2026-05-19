import { DashboardErrorState, DashboardLoadingState } from "@/components/dashboard/PageStates";
import { Button } from "@/components/ui/button";
import {
  ModerationDashboardScreen,
  useModerationDashboardController,
} from "@/pages/dashboard/moderation-dashboard";

const ModerationDashboard = () => {
  const { loadError, loading, reload, screenProps } = useModerationDashboardController();

  if (loading) {
    return <DashboardLoadingState />;
  }
  if (loadError) {
    return (
      <DashboardErrorState
        title="Moderation queue unavailable"
        description={loadError}
        action={
          <Button variant="outline" onClick={reload}>
            Try again
          </Button>
        }
      />
    );
  }
  return <ModerationDashboardScreen {...screenProps} />;
};

export default ModerationDashboard;
