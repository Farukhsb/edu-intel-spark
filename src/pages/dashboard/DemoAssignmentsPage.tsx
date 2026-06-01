import { useAuth } from "@/contexts/AuthContext";
import { DemoAssignmentsScreen } from "@/pages/dashboard/assignments/screen";
import { useDemoAssignmentsController } from "@/pages/dashboard/assignments/useDemoAssignmentsController";

const DemoAssignmentsPage = () => {
  const { role } = useAuth();
  const controller = useDemoAssignmentsController(role);

  return <DemoAssignmentsScreen {...controller} />;
};

export default DemoAssignmentsPage;
