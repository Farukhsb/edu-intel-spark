import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { NSSMetric, QAAMetric, TEFIndicator } from "@/lib/accreditationMetrics";
import {
  DEMO_FEEDBACK_TURNAROUND,
  DEMO_NSS_METRICS,
  DEMO_QAA_METRICS,
  DEMO_TEF_INDICATORS,
} from "./demoData";

type AccreditationWorkflowTarget = {
  href: string;
  label: string;
} | null;

type DemoAccreditationDashboardSummary = {
  overallCompliance: number;
  metCount: number;
  atRiskCount: number;
  belowCount: number;
  nssAverage: number;
  nssBenchmarkAverage: number;
  weakestQaaMetric: QAAMetric | undefined;
  weakestTefIndicator: TEFIndicator | undefined;
};

type DemoAccreditationDashboardController = {
  isDemo: true;
  activeTab: string;
  setActiveTab: (value: string) => void;
  loading: false;
  loadError: false;
  qaaMetrics: QAAMetric[];
  nssMetrics: NSSMetric[];
  tefIndicators: TEFIndicator[];
  feedbackTurnaround: typeof DEMO_FEEDBACK_TURNAROUND;
  summary: DemoAccreditationDashboardSummary;
  statusIcon: (status: string) => "met" | "at-risk" | "below";
  tefColor: (rating: string) => string;
  exportQAAReport: () => void;
  pendingWorkflowTarget: AccreditationWorkflowTarget;
  openPendingWorkflow: () => void;
  openSubmissionOversight: () => void;
  openAssignmentOversight: () => void;
};

export const useDemoAccreditationDashboardController = (): DemoAccreditationDashboardController => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("qaa");
  const [qaaMetrics] = useState<QAAMetric[]>(DEMO_QAA_METRICS);
  const [nssMetrics] = useState<NSSMetric[]>(DEMO_NSS_METRICS);
  const [tefIndicators] = useState<TEFIndicator[]>(DEMO_TEF_INDICATORS);
  const [feedbackTurnaround] = useState(DEMO_FEEDBACK_TURNAROUND);
  const pendingWorkflowTarget: AccreditationWorkflowTarget = null;

  const summary = useMemo(() => {
    const overallCompliance =
      qaaMetrics.length > 0 ? Math.round((qaaMetrics.filter((metric) => metric.status === "met").length / qaaMetrics.length) * 100) : 0;
    const metCount = qaaMetrics.filter((metric) => metric.status === "met").length;
    const atRiskCount = qaaMetrics.filter((metric) => metric.status === "at-risk").length;
    const belowCount = qaaMetrics.filter((metric) => metric.status === "below").length;
    const nssAverage =
      nssMetrics.length > 0 ? Math.round(nssMetrics.reduce((sum, metric) => sum + metric.score, 0) / nssMetrics.length) : 0;
    const nssBenchmarkAverage =
      nssMetrics.length > 0 ? Math.round(nssMetrics.reduce((sum, metric) => sum + metric.benchmark, 0) / nssMetrics.length) : 0;

    return {
      overallCompliance,
      metCount,
      atRiskCount,
      belowCount,
      nssAverage,
      nssBenchmarkAverage,
      weakestQaaMetric: [...qaaMetrics].sort((left, right) => left.value - right.value)[0],
      weakestTefIndicator: [...tefIndicators].sort((left, right) => left.score - right.score)[0],
    };
  }, [nssMetrics, qaaMetrics, tefIndicators]);

  return {
    isDemo: true,
    activeTab,
    setActiveTab,
    loading: false,
    loadError: false,
    qaaMetrics,
    nssMetrics,
    tefIndicators,
    feedbackTurnaround,
    summary,
    statusIcon: (status: string) => {
      if (status === "met") return "met";
      if (status === "at-risk") return "at-risk";
      return "below";
    },
    tefColor: (rating: string) => {
      if (rating === "gold") return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
      if (rating === "silver") return "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300";
      if (rating === "bronze") return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
      return "bg-muted text-muted-foreground";
    },
    exportQAAReport: () => {
      const lines = ["QAA Compliance Report - GradeAI", `Generated: ${new Date().toISOString().slice(0, 10)}`, ""];
      lines.push("Metric,Value,Target,Status,Detail");
      qaaMetrics.forEach((metric) => lines.push(`"${metric.metric}",${metric.value}%,${metric.target}%,${metric.status},"${metric.detail}"`));
      lines.push("", `Overall Compliance: ${summary.overallCompliance}%`);
      lines.push(`Met: ${summary.metCount}, At Risk: ${summary.atRiskCount}, Below: ${summary.belowCount}`);

      const blob = new Blob([lines.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `qaa_compliance_report_${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    },
    pendingWorkflowTarget,
    openPendingWorkflow: () => navigate("/demo/dashboard/accreditation"),
    openSubmissionOversight: () => navigate("/demo/dashboard/accreditation"),
    openAssignmentOversight: () => navigate("/demo/dashboard/accreditation"),
  };
};
