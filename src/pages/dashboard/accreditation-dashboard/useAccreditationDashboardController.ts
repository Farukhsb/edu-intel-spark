import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { log } from "@/lib/logger";
import { useAuth } from "@/contexts/AuthContext";
import { deriveAccreditationMetrics, type NSSMetric, type QAAMetric, type TEFIndicator } from "@/lib/accreditationMetrics";
import { fetchAccreditationDataset } from "@/lib/data/academic";
import {
  DEMO_FEEDBACK_TURNAROUND,
  DEMO_NSS_METRICS,
  DEMO_QAA_METRICS,
  DEMO_TEF_INDICATORS,
} from "./demoData";

const exportQAAReport = (qaaMetrics: QAAMetric[], summary: { overallCompliance: number; metCount: number; atRiskCount: number; belowCount: number }) => {
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
};

export const useAccreditationDashboardController = () => {
  const { isDemo } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("qaa");
  const [loading, setLoading] = useState(!isDemo);
  const [loadError, setLoadError] = useState(false);
  const [qaaMetrics, setQaaMetrics] = useState<QAAMetric[]>([]);
  const [nssMetrics, setNssMetrics] = useState<NSSMetric[]>([]);
  const [tefIndicators, setTefIndicators] = useState<TEFIndicator[]>([]);
  const [feedbackTurnaround, setFeedbackTurnaround] = useState({ avg: 0, target: 15, compliant: 0, total: 0 });

  useEffect(() => {
    if (isDemo) {
      setQaaMetrics(DEMO_QAA_METRICS);
      setNssMetrics(DEMO_NSS_METRICS);
      setTefIndicators(DEMO_TEF_INDICATORS);
      setFeedbackTurnaround(DEMO_FEEDBACK_TURNAROUND);
      setLoadError(false);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const { grades, submissions, assignments, profiles } = await fetchAccreditationDataset();

        const derived = deriveAccreditationMetrics({
          grades,
          submissions,
          assignments,
          profiles,
        });

        setQaaMetrics(derived.qaaMetrics);
        setNssMetrics(derived.nssMetrics);
        setTefIndicators(derived.tefIndicators);
        setFeedbackTurnaround(derived.feedbackTurnaround);
        setLoadError(false);
      } catch (error) {
        log.error("Failed to fetch accreditation data", error);
        setQaaMetrics([]);
        setNssMetrics([]);
        setTefIndicators([]);
        setLoadError(true);
      }
      setLoading(false);
    };

    void fetchData();
  }, [isDemo]);

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

  const statusIcon = (status: string) => {
    if (status === "met") return "met";
    if (status === "at-risk") return "at-risk";
    return "below";
  };

  const tefColor = (rating: string) => {
    if (rating === "gold") return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
    if (rating === "silver") return "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300";
    if (rating === "bronze") return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
    return "bg-muted text-muted-foreground";
  };

  return {
    isDemo,
    activeTab,
    setActiveTab,
    loading,
    loadError,
    qaaMetrics,
    nssMetrics,
    tefIndicators,
    feedbackTurnaround,
    summary,
    statusIcon,
    tefColor,
    exportQAAReport: () => exportQAAReport(qaaMetrics, summary),
    openPendingSubmissions: () => navigate("/dashboard/assignments?view=needs-review"),
    openAtRiskCohort: () => navigate("/dashboard/performance?risk=high-plus"),
    openLearningOutcomes: () => navigate("/dashboard/learning-outcomes"),
  };
};
