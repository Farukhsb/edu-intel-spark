import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLoadingState } from "@/components/dashboard/PageStates";
import { Button } from "@/components/ui/button";

import { useAssignmentDetailController } from "@/pages/dashboard/assignment-detail/controllers";
import { getDemoAssignmentSetById } from "@/pages/dashboard/demoAssignments";
import { AssignmentDetailScreen } from "@/pages/dashboard/assignment-detail/ui";

const AssignmentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { role, user, profile, isDemo } = useAuth();
  const navigate = useNavigate();
  const demoAssignmentSet = isDemo && id ? getDemoAssignmentSetById(id) : null;

  const { assignment, loading, screenProps } = useAssignmentDetailController({
    demoAssignmentSet,
    hasUser: Boolean(user),
    id,
    isDemo,
    profile,
    role,
    user,
  });

  if (loading) {
    return <DashboardLoadingState />;
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
