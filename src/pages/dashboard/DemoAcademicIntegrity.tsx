import { DashboardLoadingState } from "@/components/dashboard/PageStates";
import { decisionOptions } from "./academic-integrity";
import { DemoAcademicIntegrityScreen } from "./academic-integrity/demo-screen";
import { useDemoAcademicIntegrityController } from "./academic-integrity/useDemoAcademicIntegrityController";

const DemoAcademicIntegrity = () => {
  const controller = useDemoAcademicIntegrityController();

  if (controller.loading) {
    return <DashboardLoadingState />;
  }

  return <DemoAcademicIntegrityScreen {...controller} decisionOptions={decisionOptions} />;
};

export default DemoAcademicIntegrity;
