import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardErrorState, DashboardLoadingState } from "@/components/dashboard/PageStates";
import { Button } from "@/components/ui/button";

import { useAssignmentDetailController } from "@/pages/dashboard/assignment-detail/controllers";
import { AssignmentDetailScreen } from "@/pages/dashboard/assignment-detail/ui/screen";

const AssignmentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { role, user, profile } = useAuth();
  const navigate = useNavigate();

  const { assignment, loadError, loading, refreshData, screenProps } = useAssignmentDetailController({
    hasUser: Boolean(user),
    id,
    profile,
    role,
    user,
  });

  if (loading) {
    return <DashboardLoadingState />;
  }

  if (loadError) {
    return (
      <DashboardErrorState
        title="Assignment workflow unavailable"
        description={loadError}
        action={
          <Button variant="outline" onClick={() => void refreshData()}>
            Try again
          </Button>
        }
      />
    );
  }

  if (!assignment) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Assignment not found or access denied</p>
        <Button variant="link" onClick={() => navigate("/dashboard/assignments")}>Back to assignments</Button>
      </div>
    );
  }

  return screenProps ? <AssignmentDetailScreen {...screenProps} /> : null;
};

export default AssignmentDetail;
