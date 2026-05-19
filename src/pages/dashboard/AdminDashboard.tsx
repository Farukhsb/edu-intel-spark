import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DashboardErrorState,
  DashboardLiveBanner,
  DashboardLoadingState,
} from "@/components/dashboard/PageStates";

import { useAdminDashboardController } from "@/pages/dashboard/admin-dashboard/controllers";
import { AdminDashboardScreen } from "@/pages/dashboard/admin-dashboard/ui";

const AdminDashboard = () => {
  const { profile, status, viewModel, actions } = useAdminDashboardController();

  if (status.loading) {
    return <DashboardLoadingState />;
  }

  if (status.loadError) {
    return (
      <DashboardErrorState
        title="Admin dashboard unavailable"
        description={status.loadError}
        action={
          <Button variant="outline" onClick={() => void actions.loadAdminDashboard()}>
            Try again
          </Button>
        }
      />
    );
  }

  if (profile?.role !== "admin") {
    return (
      <Card className="shadow-sm">
        <CardContent className="py-10 text-center">
          <p className="text-sm font-medium">Admin access required</p>
          <p className="mt-1 text-sm text-muted-foreground">This dashboard is only available to admin users.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardLiveBanner label="Viewing live admin oversight data. Individual operational cards are tagged when a signal is inferred or not yet measured." />
      <AdminDashboardScreen viewModel={viewModel} actions={actions} />
    </div>
  );
};

export default AdminDashboard;
