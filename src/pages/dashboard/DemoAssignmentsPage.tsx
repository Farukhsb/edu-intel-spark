import { useAuth } from "@/contexts/AuthContext";
import { AssignmentsScreen } from "@/pages/dashboard/assignments/screen";
import { useDemoAssignmentsController } from "@/pages/dashboard/assignments/useDemoAssignmentsController";

const DemoAssignmentsPage = () => {
  const { role } = useAuth();
  const controller = useDemoAssignmentsController(role);

  return <AssignmentsScreen {...controller} />;
};

export default DemoAssignmentsPage;
