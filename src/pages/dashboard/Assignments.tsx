import { useAuth } from "@/contexts/AuthContext";
import { AssignmentsScreen } from "./assignments/live-screen";
import { useAssignmentsController } from "./assignments/useAssignmentsController";

const Assignments = () => {
  const { role, user } = useAuth();
  const controller = useAssignmentsController({
    role,
    userId: user?.id,
  });

  return <AssignmentsScreen {...controller} />;
};

export default Assignments;
