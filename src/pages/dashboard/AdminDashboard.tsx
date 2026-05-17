import { Card, CardContent } from "@/components/ui/card";
import { DashboardLoadingState } from "@/components/dashboard/PageStates";

import { useAdminDashboardController } from "@/pages/dashboard/admin-dashboard/controllers";
import { AdminDashboardScreen } from "@/pages/dashboard/admin-dashboard/ui";

const AdminDashboard = () => {
  const { profile, state, actions } = useAdminDashboardController();

  if (state.loading) {
    return <DashboardLoadingState />;
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

  return <AdminDashboardScreen state={state} actions={actions} />;
};

export default AdminDashboard;
