import { DashboardLoadingState } from "@/components/dashboard/PageStates";
import {
  AcademicIntegrityScreen,
  decisionOptions,
} from "./academic-integrity";
import { useDemoAcademicIntegrityController } from "./academic-integrity/useDemoAcademicIntegrityController";

const DemoAcademicIntegrity = () => {
  const controller = useDemoAcademicIntegrityController();

  if (controller.loading) {
    return <DashboardLoadingState />;
  }

  return <AcademicIntegrityScreen {...controller} decisionOptions={decisionOptions} />;
};

export default DemoAcademicIntegrity;
