import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, FileSearch, Scale, Shield } from "lucide-react";
import { toast } from "sonner";
import { buildIntegrityDrafts, buildIntegrityOverview, buildIntegrityTotals, getAcademicIntegrityReadiness } from "@/lib/integrityQueue";
import { DEMO_INTEGRITY_CASES } from "./demoData";
import type { IntegrityOverviewItem, IntegrityQueueFilter } from "./types";
import type { IntegrityDecision } from "@/lib/integrityReviews";

const DEMO_DRAFTS = buildIntegrityDrafts(DEMO_INTEGRITY_CASES);

const withOverviewIcons = (items: ReturnType<typeof buildIntegrityOverview>): IntegrityOverviewItem[] =>
  items.map((stat) => ({
    ...stat,
    icon:
      stat.label === "Submissions Scanned"
        ? FileSearch
        : stat.label === "Flagged for Review"
          ? AlertTriangle
          : stat.label === "Open Investigations"
            ? Scale
            : Shield,
  }));

export const decisionOptions: IntegrityDecision[] = ["pending", "clear", "investigate", "misconduct-concern"];

export const useDemoAcademicIntegrityController = () => {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<IntegrityOverviewItem[]>(() =>
    withOverviewIcons(buildIntegrityOverview({ submissionsScanned: 12, cases: DEMO_INTEGRITY_CASES })),
  );
  const [flagged, setFlagged] = useState(DEMO_INTEGRITY_CASES);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [decisionDrafts, setDecisionDrafts] = useState<Record<string, IntegrityDecision>>(() => DEMO_DRAFTS.decisionDrafts);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>(() => DEMO_DRAFTS.noteDrafts);
  const [queueFilter, setQueueFilter] = useState<IntegrityQueueFilter>("pending");

  const totals = useMemo(() => buildIntegrityTotals(flagged), [flagged]);
  const integrityReadiness = useMemo(
    () =>
      getAcademicIntegrityReadiness({
        cases: flagged,
        totals,
      }),
    [flagged, totals],
  );

  const filteredCases = useMemo(() => {
    if (queueFilter === "pending") {
      return flagged.filter((item) => item.decision === "pending");
    }
    if (queueFilter === "investigate") {
      return flagged.filter((item) => item.decision === "investigate");
    }
    return flagged.filter((item) => item.decision === "clear" || item.decision === "misconduct-concern");
  }, [flagged, queueFilter]);

  const queueCounts = useMemo(
    () => ({
      pending: flagged.filter((item) => item.decision === "pending").length,
      investigate: flagged.filter((item) => item.decision === "investigate").length,
      resolved: flagged.filter((item) => item.decision === "clear" || item.decision === "misconduct-concern").length,
    }),
    [flagged],
  );

  const queueEmptyMessage =
    queueFilter === "pending"
      ? "No pending integrity decisions right now."
      : queueFilter === "investigate"
        ? "No active investigations right now."
        : "No resolved integrity cases yet.";

  const saveDecision = async (item: (typeof DEMO_INTEGRITY_CASES)[number]) => {
    const nextDecision = decisionDrafts[item.submissionId] || "pending";
    const note = noteDrafts[item.submissionId]?.trim() || "";
    const historyEntry = {
      id: `demo-history-${Date.now()}`,
      decision: nextDecision,
      note: note || "Demo integrity review saved.",
      createdAt: new Date().toISOString(),
    };

    setFlagged((current) =>
      current.map((entry) =>
        entry.submissionId === item.submissionId ? { ...entry, decision: nextDecision, history: [historyEntry, ...entry.history] } : entry,
      ),
    );
    setNoteDrafts((current) => ({ ...current, [item.submissionId]: "" }));
    toast.success("Demo integrity review saved.");
  };

  const decisionVariant = (decision: IntegrityDecision) => {
    if (decision === "clear") return "default";
    if (decision === "misconduct-concern") return "destructive";
    if (decision === "investigate") return "secondary";
    return "outline";
  };

  const riskVariant = (level: (typeof DEMO_INTEGRITY_CASES)[number]["riskLevel"]) =>
    level === "high" ? "destructive" : level === "medium" ? "secondary" : "outline";

  const riskLabel = (item: (typeof DEMO_INTEGRITY_CASES)[number]) =>
    item.analysisLimited && item.riskLevel === "low" ? "analysis limited" : `${item.riskLevel} risk`;

  return {
    loading,
    overview,
    totals,
    integrityReadiness,
    flagged,
    filteredCases,
    queueFilter,
    setQueueFilter,
    queueCounts,
    queueEmptyMessage,
    expandedId,
    setExpandedId,
    decisionDrafts,
    setDecisionDrafts,
    noteDrafts,
    setNoteDrafts,
    savingId,
    saveDecision,
    decisionVariant,
    riskVariant,
    riskLabel,
    openAssignment: (assignmentId: string) => navigate(`/dashboard/assignments/${assignmentId}`),
  };
};
