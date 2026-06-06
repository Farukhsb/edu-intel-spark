import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, FileSearch, Scale, Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logAcademicAccessEvent } from "@/lib/audit/academicAccessEvents";
import { fetchAcademicIntegrityDataset } from "@/lib/data/integrity";
import { log } from "@/lib/logger";
import { type IntegrityDecision } from "@/lib/integrityReviews";
import {
  buildIntegrityCases,
  buildIntegrityDrafts,
  buildIntegrityOverview,
  buildIntegrityTotals,
  getAcademicIntegrityReadiness,
  getIntegrityReviewType,
  type FlaggedIntegrityCase,
} from "@/lib/integrityQueue";
import { persistIntegrityDecision } from "@/lib/integrityDecisionPersistence";
import type {
  IntegrityOverviewItem,
  IntegrityQueueFilter,
  StoredIntegrityReview,
  SubmissionRow,
} from "./types";

export const decisionOptions: IntegrityDecision[] = [
  "pending",
  "clear",
  "investigate",
  "misconduct-concern",
];

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

export const useAcademicIntegrityController = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<IntegrityOverviewItem[]>([]);
  const [flagged, setFlagged] = useState<FlaggedIntegrityCase[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [decisionDrafts, setDecisionDrafts] = useState<Record<string, IntegrityDecision>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [queueFilter, setQueueFilter] = useState<IntegrityQueueFilter>("pending");
  const lastLoggedExpandedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const { assignments, submissions, reviews } = await fetchAcademicIntegrityDataset(user.id);

        if (assignments.length === 0) {
          setOverview(
            withOverviewIcons([
              { label: "Submissions Scanned", value: "0" },
              { label: "Flagged for Review", value: "0" },
              { label: "Open Investigations", value: "0" },
              { label: "Cleared", value: "0" },
            ]),
          );
          setFlagged([]);
          setLoading(false);
          return;
        }

        const cases = buildIntegrityCases({
          reviews: reviews as Array<
            Pick<StoredIntegrityReview, "submission_id" | "decision" | "lecturer_note" | "updated_at">
          >,
          submissions,
          assignments: assignments.map((assignment) => ({ id: assignment.id, title: assignment.title })),
        });
        const drafts = buildIntegrityDrafts(cases);

        setOverview(withOverviewIcons(buildIntegrityOverview({ submissionsScanned: submissions.length, cases })));
        setFlagged(cases);
        setDecisionDrafts(drafts.decisionDrafts);
        setNoteDrafts(drafts.noteDrafts);
      } catch (error) {
        log.error("Failed to fetch integrity data", error);
        toast.error("Could not load academic integrity cases.");
      }

      setLoading(false);
    };

    void fetchData();
  }, [user]);

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

  useEffect(() => {
    if (!user || !expandedId) {
      return;
    }

    if (lastLoggedExpandedIdRef.current === expandedId) {
      return;
    }

    const item = flagged.find((entry) => entry.submissionId === expandedId);
    if (!item) {
      return;
    }

    lastLoggedExpandedIdRef.current = expandedId;
    void logAcademicAccessEvent({
      actorId: user.id,
      actorRole: "lecturer",
      institutionId: profile?.institution_id ?? null,
      eventType: "integrity_evidence_viewed",
      resourceType: "academic_integrity_review",
      resourceId: item.submissionId,
      assignmentId: item.assignmentId,
      submissionId: item.submissionId,
      metadata: {
        source: "academic_integrity_queue",
        decision: item.decision,
        riskLevel: item.riskLevel,
      },
    });
  }, [expandedId, flagged, profile?.institution_id, user]);

  const saveDecision = async (item: FlaggedIntegrityCase) => {
    if (!user) return;

    const nextDecision = decisionDrafts[item.submissionId] || "pending";
    const note = noteDrafts[item.submissionId]?.trim() || "";

    setSavingId(item.submissionId);
    const { error, nextHistory } = await persistIntegrityDecision({
      supabase,
      lecturerId: user.id,
      item,
      decision: nextDecision,
      note,
      reviewType: getIntegrityReviewType(item),
    });
    setSavingId(null);

    if (error) {
      log.error("Failed to save academic integrity review", error, {
        submissionId: item.submissionId,
      });
      toast.error("Could not save integrity review.");
      return;
    }

    setFlagged((current) =>
      current.map((entry) =>
        entry.submissionId === item.submissionId
          ? { ...entry, decision: nextDecision, history: nextHistory }
          : entry,
      ),
    );
    setNoteDrafts((current) => ({ ...current, [item.submissionId]: "" }));
    toast.success("Integrity review saved.");
  };

  const decisionVariant = (decision: IntegrityDecision) => {
    if (decision === "clear") return "default";
    if (decision === "misconduct-concern") return "destructive";
    if (decision === "investigate") return "secondary";
    return "outline";
  };

  const riskVariant = (level: FlaggedIntegrityCase["riskLevel"]) =>
    level === "high" ? "destructive" : level === "medium" ? "secondary" : "outline";

  const riskLabel = (item: FlaggedIntegrityCase) =>
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
