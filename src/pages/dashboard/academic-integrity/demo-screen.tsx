import { DashboardDemoBanner } from "@/components/dashboard/PageStates";

import { AcademicIntegrityScreen } from "./screen";
import type { useDemoAcademicIntegrityController, decisionOptions } from "./useDemoAcademicIntegrityController";

type DemoAcademicIntegrityScreenProps = ReturnType<typeof useDemoAcademicIntegrityController> & {
  decisionOptions: typeof decisionOptions;
};

export const DemoAcademicIntegrityScreen = (props: DemoAcademicIntegrityScreenProps) => (
  <div className="space-y-6 animate-fade-in">
    <DashboardDemoBanner label="Viewing demo academic integrity data" />
    <AcademicIntegrityScreen {...props} decisionOptions={props.decisionOptions} />
  </div>
);
