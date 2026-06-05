import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { log } from "@/lib/logger";
import {
  buildOfsB3EvidencePackMarkdown,
  buildTefNarrativeSubmissionMarkdown,
} from "@/lib/accreditationEvidencePacks";
import {
  getAssignmentWorkflowTargetFromStats,
  type AssignmentWorkflowStatsLike,
} from "@/lib/assignmentWorkflowNavigation";
import { deriveAccreditationMetrics, type NSSMetric, type QAAMetric, type TEFIndicator } from "@/lib/accreditationMetrics";
import { fetchAccreditationDataset } from "@/lib/data/academic";

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

const downloadMarkdown = (content: string, filename: string) => {
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

type AccreditationWorkflowTarget = {
  href: string;
  label: string;
} | null;

const PENDING_REVIEW_STATUSES = new Set([
  "submitted",
  "ai_grading",
  "ai_graded",
  "first_review",
  "moderation_pending",
  "moderation_in_progress",
  "escalated",
  "under_review",
]);

const GRADED_WORKFLOW_STATUSES = new Set([
  "ai_graded",
  "first_review",
  "moderation_pending",
  "moderation_in_progress",
  "moderated",
  "escalated",
  "under_review",
  "approved",
  "released",
]);

const buildAccreditationWorkflowTarget = ({
  assignments,
  submissions,
  grades,
}: {
  assignments: Array<{ id: string }>;
  submissions: Array<{ id: string; assignment_id: string; status?: string | null }>;
  grades: Array<{ submission_id: string }>;
}): AccreditationWorkflowTarget => {
  if (assignments.length === 0 || submissions.length === 0) return null;

  const gradeSubmissionIds = new Set(grades.map((grade) => grade.submission_id));
  const assignmentStats = new Map<string, AssignmentWorkflowStatsLike>();

  assignments.forEach((assignment) => {
    assignmentStats.set(assignment.id, {
      total: 0,
      needsReview: 0,
      graded: 0,
      approved: 0,
      released: 0,
    });
  });

  submissions.forEach((submission) => {
    const stats = assignmentStats.get(submission.assignment_id);
    if (!stats) return;

    stats.total += 1;
    const status = submission.status ?? "";

    if (PENDING_REVIEW_STATUSES.has(status)) {
      stats.needsReview += 1;
    }

    if (status === "approved") {
      stats.approved += 1;
    }

    if (status === "released") {
      stats.released += 1;
    }

    if (GRADED_WORKFLOW_STATUSES.has(status) || gradeSubmissionIds.has(submission.id)) {
      stats.graded += 1;
    }
  });

  const rankedAssignments = [...assignmentStats.entries()]
    .map(([assignmentId, stats]) => ({
      assignmentId,
      stats,
      pressure:
        stats.needsReview * 100 +
        Math.max(stats.approved - stats.released, 0) * 10 +
        Math.max(stats.graded - stats.approved, 0),
    }))
    .filter((entry) => entry.pressure > 0)
    .sort((left, right) => right.pressure - left.pressure);

  const topAssignment = rankedAssignments[0];
  if (!topAssignment) return null;

  return getAssignmentWorkflowTargetFromStats({
    assignmentId: topAssignment.assignmentId,
    stats: topAssignment.stats,
  });
};

export const useAccreditationDashboardController = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("qaa");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [qaaMetrics, setQaaMetrics] = useState<QAAMetric[]>([]);
  const [nssMetrics, setNssMetrics] = useState<NSSMetric[]>([]);
  const [tefIndicators, setTefIndicators] = useState<TEFIndicator[]>([]);
  const [feedbackTurnaround, setFeedbackTurnaround] = useState({ avg: 0, target: 15, compliant: 0, total: 0 });
  const [pendingWorkflowTarget, setPendingWorkflowTarget] = useState<AccreditationWorkflowTarget>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
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
        setPendingWorkflowTarget(
          buildAccreditationWorkflowTarget({
            assignments,
            submissions,
            grades,
          }),
        );
        setLoadError(false);
      } catch (error) {
        log.error("Failed to fetch accreditation data", error);
        setQaaMetrics([]);
        setNssMetrics([]);
        setTefIndicators([]);
        setPendingWorkflowTarget(null);
        setLoadError(true);
      }
      setLoading(false);
    };

    void fetchData();
  }, []);

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
    exportOfsB3EvidencePack: () =>
      downloadMarkdown(
        buildOfsB3EvidencePackMarkdown({
          qaaMetrics,
          nssMetrics,
          tefIndicators,
          feedbackTurnaround,
          summary,
        }),
        `ofs_b3_evidence_pack_${new Date().toISOString().slice(0, 10)}.md`,
      ),
    exportTefNarrativeSubmission: () =>
      downloadMarkdown(
        buildTefNarrativeSubmissionMarkdown({
          qaaMetrics,
          nssMetrics,
          tefIndicators,
          feedbackTurnaround,
          summary,
        }),
        `tef_narrative_submission_${new Date().toISOString().slice(0, 10)}.md`,
      ),
    pendingWorkflowTarget,
    openPendingWorkflow: () => navigate(pendingWorkflowTarget?.href ?? "/dashboard/assignments?view=needs-review"),
    openSubmissionOversight: () => navigate("/dashboard?view=submissions"),
    openAssignmentOversight: () => navigate("/dashboard?view=assignments"),
  };
};
