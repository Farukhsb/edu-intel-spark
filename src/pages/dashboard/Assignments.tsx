import { useAuth } from "@/contexts/AuthContext";
import { AssignmentsScreen } from "./assignments/screen";
import { useAssignmentsController } from "./assignments/useAssignmentsController";

const Assignments = () => {
  const { role, user, isDemo } = useAuth();
  const controller = useAssignmentsController({
    role,
    userId: user?.id,
    isDemo,
  });

  return <AssignmentsScreen {...controller} />;
};

export default Assignments;
