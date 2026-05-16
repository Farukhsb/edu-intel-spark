import { Loader2 } from "lucide-react";
import {
  ModerationDashboardScreen,
  useModerationDashboardController,
} from "@/pages/dashboard/moderation-dashboard";

const ModerationDashboard = () => {
  const { loading, screenProps } = useModerationDashboardController();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return <ModerationDashboardScreen {...screenProps} />;
};

export default ModerationDashboard;
