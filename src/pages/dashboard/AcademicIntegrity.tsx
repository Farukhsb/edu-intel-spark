import { DashboardLoadingState } from "@/components/dashboard/PageStates";
import {
  AcademicIntegrityScreen,
  decisionOptions,
  useAcademicIntegrityController,
} from "./academic-integrity";

const AcademicIntegrity = () => {
  const controller = useAcademicIntegrityController();

  if (controller.loading) {
    return <DashboardLoadingState />;
  }

  return <AcademicIntegrityScreen {...controller} decisionOptions={decisionOptions} />;
};

export default AcademicIntegrity;
