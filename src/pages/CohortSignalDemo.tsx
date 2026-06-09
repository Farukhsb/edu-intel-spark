import { Sparkles } from "lucide-react";

import {
  COHORT_SIGNAL_BAND_REPORT,
  COHORT_SIGNAL_FAILURE_REPORT,
  COHORT_SIGNAL_REFERENCE_NOW,
  createInterventionTimestamp,
  DEMO_COHORT_SIGNAL_STUDENTS,
} from "@/pages/cohortsignal-demo/demoData";
import { CohortSignalHeatmapView } from "@/pages/cohortsignal/HeatmapView";

const CohortSignalDemo = () => (
  <CohortSignalHeatmapView
    title="CohortSignal Demo | Cohort Heatmap"
    description="Synthetic cohort heatmap demo with filters, detail panels, and intervention logging."
    path="/cohortsignal-demo"
    robots="noindex,follow"
    bannerLabel="Demo only, synthetic data"
    bannerIcon={<Sparkles className="h-3.5 w-3.5" />}
    introText="A mock student support workflow for predicting which students might fail, filtering the most urgent cases, and logging interventions without any live system calls."
    modelQualityDescription="Deterministic holdout and 5-fold cross-validation metrics from the bundled CSVs."
    students={DEMO_COHORT_SIGNAL_STUDENTS}
    bandReport={COHORT_SIGNAL_BAND_REPORT}
    failureReport={COHORT_SIGNAL_FAILURE_REPORT}
    isDemo
    onLogIntervention={() => createInterventionTimestamp()}
  />
);

export default CohortSignalDemo;
